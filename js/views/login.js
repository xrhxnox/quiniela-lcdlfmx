import { login } from "../auth.js";
import { h, clearAndAppend } from "../utils.js";

export function renderLogin(container, onSuccess) {
  const errorEl = h("div", { class: "error-msg" });
  const userInput = h("input", { type: "text", id: "loginUser", autocomplete: "username", placeholder: "tu.usuario" });
  const passInput = h("input", { type: "password", id: "loginPass", autocomplete: "current-password", placeholder: "••••••••" });
  const submitBtn = h("button", { class: "btn", type: "submit" }, "Entrar");

  const form = h(
    "form",
    {
      class: "login-card",
      onsubmit: async (e) => {
        e.preventDefault();
        errorEl.textContent = "";
        submitBtn.disabled = true;
        submitBtn.textContent = "Entrando…";
        try {
          await login(userInput.value, passInput.value);
          onSuccess();
        } catch (err) {
          errorEl.textContent = "Usuario o contraseña incorrectos.";
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Entrar";
        }
      },
    },
    [
      h("div", {}, [h("label", {}, "Usuario"), userInput]),
      h("div", {}, [h("label", {}, "Contraseña"), passInput]),
      errorEl,
      submitBtn,
      h("p", { class: "muted", style: "font-size:0.75rem;text-align:center;margin-top:6px" }, "¿No tienes cuenta? Pídele al admin de la quiniela que te dé de alta."),
    ]
  );

  const wrap = h("div", { class: "login-wrap" }, [
    h("img", { class: "logo", src: "assets/logo.png", alt: "La Casa de los Famosos México" }),
    form,
  ]);

  clearAndAppend(container, wrap);
  userInput.focus();
}
