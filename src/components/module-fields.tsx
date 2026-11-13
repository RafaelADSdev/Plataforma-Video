type ModuleFieldsProps = {
  fieldId: string;
  module?: {
    title: string;
    description: string | null;
    scheduled_for: string | null;
    lessons_in_order: boolean;
    require_previous_modules: boolean;
  };
};

export const moduleFieldLabels = {
  title: "Título",
  description: "Descrição breve",
  scheduled_for: "Data no cronograma",
};

export function ModuleFields({ fieldId, module }: ModuleFieldsProps) {
  return (
    <>
      <div className="form-row">
        <div className="field">
          <label htmlFor={`${fieldId}-title`}>Título do módulo</label>
          <input className="input" id={`${fieldId}-title`} name="title" defaultValue={module?.title} required minLength={2} maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor={`${fieldId}-date`}>Data no cronograma</label>
          <input className="input" id={`${fieldId}-date`} name="scheduled_for" type="date" lang="pt-BR" defaultValue={module?.scheduled_for ?? ""} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${fieldId}-description`}>Descrição breve</label>
        <textarea
          className="textarea compact"
          id={`${fieldId}-description`}
          name="description"
          defaultValue={module?.description ?? ""}
          rows={2}
          maxLength={320}
          aria-describedby={`${fieldId}-description-hint`}
        />
        <p className="field-hint" id={`${fieldId}-description-hint`}>Opcional, até 320 caracteres.</p>
      </div>
      <fieldset className="module-progression-fields">
        <legend>Ordem de estudo</legend>
        <label className="checkbox">
          <input type="checkbox" name="lessons_in_order" defaultChecked={module?.lessons_in_order} />
          Exigir conclusão da aula anterior
        </label>
        <label className="checkbox">
          <input type="checkbox" name="require_previous_modules" defaultChecked={module?.require_previous_modules} />
          Exigir conclusão dos módulos anteriores
        </label>
      </fieldset>
    </>
  );
}
