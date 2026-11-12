import { WEEKDAYS, WEEKDAY_LABELS } from "./schedule";
import { formatPlannerMonth, type PlannerWeek, type StudyPlan } from "./study-planner";

type ExportDay = { date: string; lines: string[] } | null;
type ExportWeek = { number: number; days: ExportDay[]; continued?: boolean };
type SheetHeading = { month: string; year: string; font: string };

const width = 1200;
const margin = 24;
const weekWidth = 74;
const dayWidth = (width - margin * 2 - weekWidth) / 7;
const gridTop = 124;
const headerHeight = 38;
const sheetPadding = gridTop + headerHeight + margin;
const lineHeight = 21;
const noteOffset = 42;
const noteFont = "16px Arial, sans-serif";
const pdfSize: [number, number] = [841.89, 595.28];
const pdfMargin = 22;
const pdfScale = (pdfSize[0] - pdfMargin * 2) / width;
const green = "#06db8d";
const ink = "#09271b";
const rule = "#20ae7e";
const paper = "#fffefa";
const header = "#edfdf4";

function wrapNote(context: CanvasRenderingContext2D, note: string): string[] {
  if (!note) return [];
  const fits = (line: string) => context.measureText(line).width <= dayWidth - 24;

  return note.split(/\r?\n/).flatMap((paragraph) => {
    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (fits(candidate)) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const character of word) {
        if (line && !fits(line + character)) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    return [...lines, line];
  });
}

function weekHeight({ days }: ExportWeek) {
  return Math.max(92, noteOffset + Math.max(...days.map((day) => day?.lines.length ?? 0)) * lineHeight + 12);
}

function paginate(weeks: ExportWeek[]): ExportWeek[][] {
  const maxRowsHeight = (pdfSize[1] - pdfMargin * 2) / pdfScale - sheetPadding;
  const maxLines = Math.floor((maxRowsHeight - noteOffset - 12) / lineHeight);
  const pages: ExportWeek[][] = [[]];
  let height = 0;

  for (const week of weeks) {
    const lineCount = Math.max(...week.days.map((day) => day?.lines.length ?? 0));
    for (let offset = 0; offset < Math.max(1, lineCount); offset += maxLines) {
      const row = {
        number: week.number,
        continued: offset > 0,
        days: week.days.map((day) => day && { ...day, lines: day.lines.slice(offset, offset + maxLines) }),
      };
      const rowHeight = weekHeight(row);
      if (height + rowHeight > maxRowsHeight) {
        pages.push([]);
        height = 0;
      }
      pages[pages.length - 1].push(row);
      height += rowHeight;
    }
  }
  return pages;
}

function drawSheet(heading: SheetHeading, weeks: ExportWeek[], pageNumber?: string) {
  const height = sheetPadding + weeks.reduce((sum, week) => sum + weekHeight(week), 0);
  const scale = Math.min(2, 8192 / height, Math.sqrt(14_000_000 / (width * height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponível.");

  context.fillStyle = green;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  context.textBaseline = "top";

  const label = (value: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") => {
    context.font = font;
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  };

  const cell = (x: number, y: number, cellWidth: number, cellHeight: number, fill: string) => {
    context.fillStyle = fill;
    context.fillRect(x, y, cellWidth, cellHeight);
    context.strokeStyle = rule;
    context.strokeRect(x, y, cellWidth, cellHeight);
  };

  label(`PLANNER MENSAL ${heading.year}`, margin, 17, heading.font, ink);
  const yearStart = margin + context.measureText("PLANNER MENSAL ").width;
  context.fillStyle = "#f9c056";
  context.fillRect(yearStart, 94, context.measureText(heading.year).width, 5);
  label(heading.month, width - margin, 58, "bold 21px Arial", ink, "right");
  if (pageNumber) label(pageNumber, width - margin, 86, "16px Arial", ink, "right");

  cell(margin, gridTop, weekWidth, headerHeight, header);
  label("SEMANA", margin + weekWidth / 2, gridTop + 11, "bold 14px Arial", "#8a4d00", "center");
  for (const [index, day] of WEEKDAYS.entries()) {
    const x = margin + weekWidth + index * dayWidth;
    cell(x, gridTop, dayWidth, headerHeight, header);
    label(WEEKDAY_LABELS[day].full.replace("-feira", "").toUpperCase(), x + dayWidth / 2, gridTop + 11, "bold 14px Arial", ink, "center");
  }

  let y = gridTop + headerHeight;
  for (const week of weeks) {
    const rowHeight = weekHeight(week);
    cell(margin, y, weekWidth, rowHeight, header);
    label(String(week.number), margin + weekWidth / 2, y + 13, "bold 24px Arial", ink, "center");
    if (week.continued) label("cont.", margin + weekWidth / 2, y + 42, "13px Arial", "#52635b", "center");

    week.days.forEach((day, index) => {
      const x = margin + weekWidth + index * dayWidth;
      cell(x, y, dayWidth, rowHeight, day ? paper : "#def7e9");
      if (!day) return;
      label(String(Number(day.date.slice(-2))), x + 12, y + 13, "bold 17px Arial", "#176054");
      day.lines.forEach((line, lineIndex) => label(line, x + 12, y + noteOffset + lineIndex * lineHeight, noteFont, ink));
    });
    y += rowHeight;
  }

  context.strokeStyle = ink;
  context.lineWidth = 2;
  context.strokeRect(margin, gridTop, width - margin * 2, y - gridTop);

  return canvas;
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível criar a imagem.")), "image/png");
  });
}

export async function downloadStudyPlanner(
  format: "pdf" | "png",
  month: string,
  weeks: PlannerWeek[],
  notes: StudyPlan,
  titleFamily = 'Impact, "Arial Narrow", sans-serif',
) {
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("Canvas indisponível.");
  measure.font = noteFont;
  const heading = { month: formatPlannerMonth(month), year: month.slice(0, 4), font: `800 72px ${titleFamily}` };
  await document.fonts.load(heading.font).catch(() => []);
  const rows = weeks.map(({ number, dates }) => ({
    number,
    days: dates.map((date) => date ? { date, lines: wrapNote(measure, notes[date] ?? "") } : null),
  }));

  let file: Blob;
  if (format === "png") {
    file = await canvasToPng(drawSheet(heading, rows));
  } else {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    pdf.setTitle(`Plano de estudos — ${heading.month}`);
    pdf.setLanguage("pt-BR");
    const pages = paginate(rows);
    for (const [index, pageRows] of pages.entries()) {
      const page = pdf.addPage(pdfSize);
      const canvas = drawSheet(heading, pageRows, pages.length > 1 ? `${index + 1} / ${pages.length}` : undefined);
      const image = await pdf.embedPng(await (await canvasToPng(canvas)).arrayBuffer());
      const imageHeight = image.height * (width * pdfScale / image.width);
      page.drawImage(image, { x: pdfMargin, y: page.getHeight() - pdfMargin - imageHeight, width: width * pdfScale, height: imageHeight });
    }
    file = new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `plano-de-estudos-${month}.${format}`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
