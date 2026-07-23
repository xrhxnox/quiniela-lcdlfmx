import { h, clearAndAppend } from "../utils.js";

function ruleCard(icon, title, children) {
  return h("div", { class: "card" }, [
    h("p", { style: "margin-top:0" }, [h("i", { class: `fa-solid ${icon}` }), " ", h("strong", {}, title)]),
    ...children,
  ]);
}

export async function renderReglas(container) {
  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, "Reglas"),

      ruleCard("fa-square-poll-vertical", "Cómo se juega", [
        h("p", { style: "margin-bottom:0" }, [
          "Cada semana eliges, entre los nominados, a quién crees que van a eliminar. ",
          h("strong", {}, "Si le atinas, sumas 1 punto"), ". Puedes cambiar tu pick las veces que quieras mientras la votación siga abierta.",
        ]),
      ]),

      ruleCard("fa-calendar-days", "Calendario de la semana", [
        h("ul", { style: "margin:0;padding-left:20px" }, [
          h("li", {}, [h("strong", {}, "Lunes:"), " se anuncia el líder de la semana (inmunidad)."]),
          h("li", {}, [h("strong", {}, "Miércoles:"), " se publican los nominados y se abre la votación."]),
          h("li", {}, [h("strong", {}, "Viernes:"), " se confirma quién de los nominados ganó la salvación."]),
          h("li", { style: "margin-bottom:0" }, [h("strong", {}, "Día de eliminación:"), " se cierra la votación y se confirma quién salió."]),
        ]),
      ]),

      ruleCard("fa-shield-halved", "Líder, nominados y salvación", [
        h("ul", { style: "margin:0;padding-left:20px;margin-bottom:0" }, [
          h("li", {}, "El líder de la semana gana inmunidad y no puede ser nominado."),
          h("li", {}, "Los nominados se muestran con los puntos con los que fueron nominados."),
          h("li", {}, [
            "Si un nominado gana la salvación, sigue apareciendo en la lista con la etiqueta ",
            h("span", { class: "badge green" }, "Salvado"),
            ", pero ya nadie puede votar por él.",
          ]),
        ]),
      ]),

      ruleCard("fa-trophy", "Puntaje y Ranking", [
        h("ul", { style: "margin:0;padding-left:20px;margin-bottom:0" }, [
          h("li", {}, "El Ranking muestra el puntaje total de todos los jugadores, de mayor a menor."),
          h("li", {}, "Los picks de los demás jugadores se mantienen ocultos hasta que la semana cierra, para que nadie copie el pick de otro."),
          h("li", {}, "Después de cada semana cerrada, el Ranking muestra un feed de quién acertó y quién falló."),
        ]),
      ]),

      ruleCard("fa-user", "Mi Perfil", [
        h("ul", { style: "margin:0;padding-left:20px;margin-bottom:0" }, [
          h("li", {}, "Elige tu favorito, el que te cae mal, tu cuarto favorito, tu color de énfasis y una foto de perfil."),
          h("li", {}, "Tu perfil es público: cualquiera puede verlo desde el botón “Ver perfil” en el Ranking."),
          h("li", {}, "Consigue insignias por racha de aciertos, buena puntería y por tu cuarto favorito."),
          h("li", { style: "margin-bottom:0" }, "Puedes comparar tu historial de picks contra el de cualquier otro jugador."),
        ]),
      ]),
    ])
  );
}
