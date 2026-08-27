"use client";

import Image from "next/image";
import { UserRound } from "lucide-react";
import { useActionState, useState } from "react";
import { updateProfileAction } from "@/app/actions/profile";
import { initialActionState } from "@/lib/action-state";
import { formDisplayName } from "@/lib/profile-name";
import { createClient } from "@/lib/supabase/client";
import { storageFileUrl } from "@/lib/storage";
import { validateAvatarFile } from "@/lib/validation";
import type { Profile } from "@/types/domain";

export function ProfileForm({ profile, userId, email }: { profile: Profile; userId: string; email: string }) {
  const [preview, setPreview] = useState(storageFileUrl("avatars", profile.avatar_path));
  const [storedAvatarPath, setStoredAvatarPath] = useState(profile.avatar_path ?? "");
  const action = async (state: typeof initialActionState, formData: FormData) => {
    const file = formData.get("avatar");
    let avatarPath = storedAvatarPath;
    if (file instanceof File && file.size > 0) {
      const validation = validateAvatarFile(file);
      if (!validation.ok) return { ok: false, message: validation.error };
      const path = `${userId}/avatar`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: validation.mimeType,
        cacheControl: "3600",
        upsert: true,
      });
      if (error) return { ok: false, message: "A foto não foi enviada. Tente novamente." };
      avatarPath = path;
      setStoredAvatarPath(path);
    }
    // The image upload is complete; keep the Server Action payload textual so
    // the browser does not attempt to send the same File a second time.
    const profileData = new FormData();
    profileData.set("display_name", String(formData.get("display_name") ?? ""));
    profileData.set("bio", String(formData.get("bio") ?? ""));
    profileData.set("avatar_path", avatarPath);
    const result = await updateProfileAction(state, profileData);
    if (result.ok && avatarPath) setPreview(`${storageFileUrl("avatars", avatarPath)}?v=${Date.now()}`);
    return result;
  };
  const [state, formAction, pending] = useActionState(action, initialActionState);

  return (
    <form action={formAction} className="profile-form" noValidate>
      <div className="profile-avatar-column">
        <div className="avatar-preview">
          {preview ? <Image src={preview} alt="Sua foto de perfil" fill sizes="144px" unoptimized /> : <UserRound aria-hidden="true" size={42} />}
        </div>
        <div className="field"><label htmlFor="avatar">Trocar foto</label><input className="input" id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) setPreview(URL.createObjectURL(file));
        }} /><p className="field-hint">JPG, PNG ou WebP, até 5 MB.</p></div>
      </div>
      <div className="form-grid">
        <div className="field"><label htmlFor="profile-email">E-mail</label><input className="input" id="profile-email" value={email} disabled /><p className="field-hint">O e-mail é gerenciado pela organização.</p></div>
        <div className="field">
          <label htmlFor="display_name">Seu nome</label>
          <input
            className="input"
            id="display_name"
            name="display_name"
            defaultValue={formDisplayName(profile.display_name, email)}
            placeholder="Nome e sobrenome"
            autoComplete="name"
            maxLength={80}
            required
          />
          <p className="field-hint">É assim que você aparecerá para a turma. O e-mail permanece só para o login.</p>
          {state.fieldErrors?.display_name ? <p className="field-error">{state.fieldErrors.display_name}</p> : null}
        </div>
        <div className="field"><label htmlFor="bio">Bio</label><textarea className="textarea" id="bio" name="bio" defaultValue={profile.bio ?? ""} maxLength={280} /><p className="field-hint">Conte um pouco sobre você em até 280 caracteres.</p>{state.fieldErrors?.bio ? <p className="field-error">{state.fieldErrors.bio}</p> : null}</div>
        {state.message ? <p className={`form-message${state.ok ? " form-success" : ""}`} role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
        <button className="button" type="submit" disabled={pending}>{pending ? "Salvando perfil…" : "Salvar perfil"}</button>
      </div>
    </form>
  );
}
