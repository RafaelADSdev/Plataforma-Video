"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { saveActivityAction } from "@/app/actions/activities";
import { sanitizeStorageName, storageFileUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { isFutureDate, toSaoPauloDateTimeInput } from "@/lib/time";
import { validateMaterialFile } from "@/lib/validation";
import type { Activity, ActivityQuiz, Lesson, Module, QuizQuestion } from "@/types/domain";

function newOption() {
  return { id: crypto.randomUUID(), text: "" };
}

function newQuestion(): QuizQuestion {
  const options = [newOption(), newOption()];
  return { id: crypto.randomUUID(), prompt: "", options, correctOptionId: options[0].id };
}

export function ActivityEditor({
  modules,
  lessons,
  kind,
  activity,
  quiz,
  initialLessonId,
  initialModuleId,
}: {
  modules: Pick<Module, "id" | "title">[];
  lessons: Pick<Lesson, "id" | "module_id" | "title">[];
  kind: Activity["kind"];
  activity?: Activity;
  quiz?: ActivityQuiz | null;
  initialLessonId?: string;
  initialModuleId?: string;
}) {
  const router = useRouter();
  const activityId = useRef(activity?.id);
  const staged = useRef<{ file: File; path: string } | null>(null);
  const [lessonId, setLessonId] = useState(activity?.lesson_id ?? initialLessonId ?? "");
  const [publication, setPublication] = useState(
    activity?.published_at ? isFutureDate(activity.published_at) ? "scheduled" : "now" : "draft",
  );
  const [questions, setQuestions] = useState(quiz?.questions ?? []);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const selectedLesson = lessons.find((lesson) => lesson.id === lessonId);
  const lockedQuiz = Boolean(quiz?.hasAttempt);

  function changeQuestion(id: string, change: (question: QuizQuestion) => QuizQuestion) {
    setQuestions((current) => current.map((question) => question.id === id ? change(question) : question));
  }

  return (
    <form className="form-grid authoring-form" aria-busy={pending} onSubmit={async (event) => {
      event.preventDefault();
      setMessage("");
      const fields = new FormData(event.currentTarget);
      const file = fields.get("support");
      fields.delete("support");
      fields.set("kind", kind);
      if (selectedLesson) fields.set("module_id", selectedLesson.module_id);
      if (kind === "quiz" && !lockedQuiz) fields.set("questions", JSON.stringify(questions));
      if (kind === "quiz" && questions.length === 0) {
        setMessage("Adicione pelo menos uma questão.");
        return;
      }
      const id = activityId.current ?? crypto.randomUUID();
      activityId.current = id;
      setPending(true);
      try {
        let attachment = null;
        if (kind === "file" && file instanceof File && file.size > 0) {
          const validation = validateMaterialFile(file);
          if (!validation.ok) {
            setMessage(validation.error);
            return;
          }
          if (staged.current?.file !== file) {
            const path = `${id}/${crypto.randomUUID()}-${sanitizeStorageName(file.name).slice(-150)}`;
            const { error } = await createClient().storage.from("activity-materials").upload(path, file, { contentType: validation.mimeType });
            if (error) {
              setMessage("Não foi possível enviar o PDF de apoio. Tente novamente.");
              return;
            }
            staged.current = { file, path };
          }
          fields.delete("remove_support");
          attachment = { path: staged.current.path, name: file.name };
        }
        const result = await saveActivityAction(id, fields, attachment);
        if (!result.ok || !result.activityId) {
          setMessage(result.message ?? "Não foi possível salvar a atividade.");
          return;
        }
        router.push(`/atividades/${result.activityId}`);
        router.refresh();
      } catch {
        setMessage("Não foi possível concluir a operação. Tente novamente.");
      } finally {
        setPending(false);
      }
    }}>
      <section className="panel authoring-section" aria-labelledby="activity-content">
        <h2 id="activity-content">Conteúdo</h2>
        <div className="field"><label htmlFor="activity-title">Título</label><input id="activity-title" name="title" className="input" required minLength={2} maxLength={160} defaultValue={activity?.title} /></div>
        <div className="field"><label htmlFor="activity-instructions">Enunciado ou instruções</label><textarea id="activity-instructions" name="instructions" className="textarea" rows={4} maxLength={12000} defaultValue={activity?.instructions} /></div>
        <div className="form-row">
          <div className="field"><label htmlFor="activity-lesson">Vincular a uma aula</label>
            <select id="activity-lesson" className="select" name="lesson_id" value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
              <option value="">Atividade avulsa</option>
              {lessons.map((lesson) => <option value={lesson.id} key={lesson.id}>{lesson.title}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="activity-module">Módulo</label>
            {selectedLesson ? (
              <input id="activity-module" className="input" readOnly value={modules.find((module) => module.id === selectedLesson.module_id)?.title ?? ""} />
            ) : (
              <select id="activity-module" className="select" name="module_id" defaultValue={activity?.module_id ?? initialModuleId ?? modules[0]?.id} required>
                {modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
              </select>
            )}
          </div>
        </div>
        {kind === "file" ? (
          <div className="field">
            <label htmlFor="activity-support">PDF de apoio</label>
            <input id="activity-support" name="support" className="input" type="file" accept="application/pdf,.pdf" />
            <p className="field-hint">Opcional, até 20 MB.</p>
            {activity?.support_path ? (
              <div className="cluster">
                <Link href={storageFileUrl("activity-materials", activity.support_path)!} target="_blank" rel="noreferrer">{activity.support_name}</Link>
                <label className="checkbox"><input type="checkbox" name="remove_support" /> Remover PDF atual</label>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {kind === "quiz" ? (
        <section className="panel authoring-section" aria-labelledby="quiz-questions">
          <h2 id="quiz-questions">Questões e correção</h2>
          {lockedQuiz ? <p className="muted">Este questionário já recebeu respostas. As questões e as regras de correção estão bloqueadas.</p> : null}
          <fieldset className="quiz-settings" disabled={lockedQuiz}>
            <legend>Regras do questionário</legend>
            <label className="checkbox"><input type="checkbox" name="allow_retries" defaultChecked={quiz?.allowRetries} /> Permitir novas tentativas</label>
            <label className="checkbox"><input type="checkbox" name="show_answers" defaultChecked={quiz?.showAnswers} /> Mostrar gabarito após o envio</label>
          </fieldset>
          {questions.map((question, index) => (
            <fieldset key={question.id} className="quiz-question-edit" aria-labelledby={`question-${question.id}`} disabled={lockedQuiz}>
              <h3 className="quiz-question-edit-title" id={`question-${question.id}`}>Questão {index + 1}</h3>
              <div className="quiz-question-edit-body">
                <div className="field">
                  <label htmlFor={`prompt-${question.id}`}>Enunciado</label>
                  <textarea
                    id={`prompt-${question.id}`}
                    className="textarea"
                    placeholder="Escreva a pergunta…"
                    rows={3}
                    required
                    maxLength={2000}
                    value={question.prompt}
                    onChange={(event) => {
                      const prompt = event.target.value;
                      changeQuestion(question.id, (item) => ({ ...item, prompt }));
                    }}
                  />
                </div>
                <fieldset className="quiz-options-edit" aria-describedby={lockedQuiz ? undefined : `options-hint-${question.id}`}>
                  <legend className="field-label">Alternativas</legend>
                  {!lockedQuiz ? <p className="field-hint" id={`options-hint-${question.id}`}>Selecione a resposta correta.</p> : null}
                  {question.options.map((option, optionIndex) => {
                    const letter = String.fromCharCode(65 + optionIndex);
                    const isCorrect = question.correctOptionId === option.id;

                    return (
                      <div className="quiz-option-edit" key={option.id}>
                        <label className="quiz-option-select">
                          <input
                            type="radio"
                            name={`correct-${question.id}`}
                            aria-label={`Marcar alternativa ${letter} como correta`}
                            checked={isCorrect}
                            onChange={() => changeQuestion(question.id, (item) => ({ ...item, correctOptionId: option.id }))}
                          />
                          <span aria-hidden="true">{letter}</span>
                        </label>
                        <input
                          className="input quiz-option-text"
                          aria-label={`Texto da alternativa ${letter}`}
                          placeholder="Resposta"
                          required
                          maxLength={500}
                          value={option.text}
                          onChange={(event) => {
                            const text = event.target.value;
                            changeQuestion(question.id, (item) => ({ ...item, options: item.options.map((choice) => choice.id === option.id ? { ...choice, text } : choice) }));
                          }}
                        />
                        {isCorrect ? <span className="quiz-option-correct"><Check size={14} aria-hidden="true" /> Correta</span> : null}
                        {!lockedQuiz ? (
                          <button className="icon-button" type="button" aria-label={`Remover alternativa ${letter}`} disabled={question.options.length <= 2} onClick={() => {
                            changeQuestion(question.id, (item) => {
                              const options = item.options.filter((choice) => choice.id !== option.id);
                              return { ...item, options, correctOptionId: item.correctOptionId === option.id ? options[0]?.id : item.correctOptionId };
                            });
                          }}><Trash2 size={17} aria-hidden="true" /></button>
                        ) : null}
                      </div>
                    );
                  })}
                </fieldset>
              </div>
              {!lockedQuiz ? <div className="quiz-question-edit-actions">
                <button className="button secondary small" type="button" disabled={question.options.length >= 6} onClick={() => {
                  const option = newOption();
                  changeQuestion(question.id, (item) => ({ ...item, options: [...item.options, option] }));
                }}><Plus size={16} aria-hidden="true" /> Adicionar alternativa</button>
                <button className="button ghost small quiz-question-remove" type="button" onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}>
                  <Trash2 size={16} aria-hidden="true" /> Remover questão
                </button>
              </div> : null}
            </fieldset>
          ))}
          {!lockedQuiz ? <button className="button secondary" type="button" disabled={questions.length >= 50} onClick={() => {
            const question = newQuestion();
            setQuestions((current) => [...current, question]);
          }}><Plus size={17} aria-hidden="true" /> Adicionar questão</button> : null}
        </section>
      ) : null}

      <section className="panel authoring-section" aria-labelledby="activity-publication">
        <h2 id="activity-publication">Publicação e prazo</h2>
        <div className="form-row">
          <div className="field"><label htmlFor="publication">Visibilidade</label>
            <select id="publication" className="select" name="publication" value={publication} onChange={(event) => setPublication(event.target.value)}>
              <option value="draft">Salvar como rascunho</option><option value="now">Publicar agora</option><option value="scheduled">Agendar publicação</option>
            </select>
          </div>
          <div className="field"><label htmlFor="activity-due">Prazo de entrega</label>
            <input id="activity-due" name="due_at" type="datetime-local" className="input" aria-describedby="activity-due-hint" defaultValue={activity?.due_at ? toSaoPauloDateTimeInput(activity.due_at) : ""} />
            <p className="field-hint" id="activity-due-hint">Opcional. Envio após o prazo continua disponível.</p>
          </div>
        </div>
        {publication === "scheduled" ? <div className="field">
          <label htmlFor="activity-publish-at">Data e hora da publicação</label>
          <input id="activity-publish-at" name="published_at" type="datetime-local" className="input" required defaultValue={activity?.published_at ? toSaoPauloDateTimeInput(activity.published_at) : ""} />
          <p className="field-hint">Horário de São Paulo.</p>
        </div> : null}
      </section>
      {message ? <p className="form-message" role="alert">{message}</p> : null}
      <div className="cluster">
        <button type="submit" className="button" disabled={pending}>{pending ? "Salvando…" : publication === "draft" ? "Salvar rascunho" : publication === "scheduled" ? "Agendar atividade" : "Salvar e publicar"}</button>
        <Link href={activity ? `/atividades/${activity.id}` : initialLessonId ? `/lessons/${initialLessonId}` : initialModuleId ? `/course/modules/${initialModuleId}` : "/atividades"} className="button ghost">Cancelar</Link>
      </div>
    </form>
  );
}
