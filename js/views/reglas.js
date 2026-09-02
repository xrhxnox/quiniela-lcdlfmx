import { h, clearAndAppend } from "../utils.js";
import { badgeNode } from "./profile.js";
import { getShow, isGranja } from "../shows.js";

function badgeRow(key, label, desc) {
  return h("li", { style: "display:flex;align-items:center;gap:10px;margin-bottom:10px" }, [
    badgeNode({ key, label }, { fixedWidth: true }),
    h("span", {}, desc),
  ]);
}

function ruleCard(icon, title, children) {
  return h("div", { class: "card" }, [
    h("p", { style: "margin-top:0;font-size:1.15rem" }, [
      h("i", { class: `fa-solid ${icon}`, style: "color:var(--accent)" }),
      " ",
      h("strong", {}, title),
    ]),
    ...children,
  ]);
}

const savedBadge = () =>
  h("span", { class: "badge", style: "background:#3b82f626;color:#3b82f6;border:1px solid #3b82f6" }, "Salvado");

const ul = (items) => h("ul", { style: "margin:0;padding-left:20px;margin-bottom:0" }, items);

// =========================================================
// Tarjetas propias de LA CASA
// =========================================================
function casaCards() {
  return [
    ruleCard("fa-calendar-days", "Calendario de la semana", [
      ul([
        h("li", {}, [h("strong", {}, "Lunes:"), " se anuncia el líder de la semana (inmunidad)."]),
        h("li", {}, [h("strong", {}, "Miércoles:"), " se publican los nominados y se abre la votación."]),
        h("li", {}, [h("strong", {}, "Viernes:"), " se confirma quién de los nominados ganó la salvación."]),
        h("li", {}, [h("strong", {}, "Día de eliminación:"), " se cierra la votación y se confirma quién salió."]),
        h("li", { style: "margin-bottom:0" }, [
          h("i", { class: "fa-solid fa-hourglass-half" }),
          " ",
          h("strong", {}, "Cuenta regresiva:"),
          " el día de la nominación, en Votar aparece un contador en vivo hasta el dia y hora exacta en que se cierra la votación (entre 6 y 8 PM del domingo). Al llegar a cero, ya no puedes votar ni cambiar tu pick, aunque el admin todavía no haya confirmado quién salió — así nadie puede copiar el resultado en vivo.",
        ]),
      ]),
    ]),

    ruleCard("fa-tv", "Cronograma del Programa", [
      h("p", { class: "muted", style: "margin-bottom:10px" }, "Así se mueve la semana dentro de la casa, día por día."),
      ul([
        h("li", {}, [h("strong", {}, "Lunes:"), " Prueba de líder."]),
        h("li", {}, [h("strong", {}, "Martes:"), " Inicio de prueba semanal, Noche de Cine, Vida en Fotos, Cabina de las tentaciones."]),
        h("li", {}, [h("strong", {}, "Miércoles:"), " Noche de nominación."]),
        h("li", {}, [h("strong", {}, "Jueves:"), " Prueba robo de salvación, Final de prueba semanal, Moneda o caja del destino, Cena de nominados."]),
        h("li", {}, [h("strong", {}, "Viernes:"), " Robo de Salvación, Fiesta Temática."]),
        h("li", {}, [h("strong", {}, "Sábado:"), " Compra de despensa."]),
        h("li", { style: "margin-bottom:0" }, [h("strong", {}, "Domingo:"), " Posicionamiento, Sinceramiento, Gala de Eliminación."]),
      ]),
    ]),

    ruleCard("fa-shield-halved", "Líder, nominados y salvación", [
      ul([
        h("li", {}, "El líder de la semana gana inmunidad y no puede ser nominado."),
        h("li", {}, "Los nominados se muestran con los puntos con los que fueron nominados."),
        h("li", {}, [
          "Si un nominado gana la salvación, sigue apareciendo en la lista con la etiqueta ",
          savedBadge(),
          ", pero ya nadie puede votar por él.",
        ]),
      ]),
    ]),
  ];
}

// =========================================================
// Tarjetas propias de LA GRANJA VIP
// =========================================================
function granjaCards() {
  return [
    ruleCard("fa-calendar-days", "Calendario de la semana", [
      ul([
        h("li", {}, [h("strong", {}, "Lunes:"), " se anuncia el capataz de la semana (inmunidad)."]),
        h("li", {}, [h("strong", {}, "Martes:"), " el perdedor del duelo queda nominado."]),
        h("li", {}, [h("strong", {}, "Miércoles:"), " asamblea: se publican los nominados y se abre la votación."]),
        h("li", {}, [h("strong", {}, "Jueves y viernes:"), " se confirma la salvación y, si la hubo, la traición."]),
        h("li", {}, [h("strong", {}, "Domingo:"), " se cierra la votación y se confirma quién salió."]),
        h("li", { style: "margin-bottom:0" }, [
          h("i", { class: "fa-solid fa-hourglass-half" }),
          " ",
          h("strong", {}, "Cuenta regresiva:"),
          " en Votar aparece un contador en vivo hasta la hora exacta en que se cierra la votación. Al llegar a cero ya no puedes votar ni cambiar tu pick, aunque el admin todavía no haya confirmado quién salió — así nadie puede copiar el resultado en vivo.",
        ]),
      ]),
    ]),

    ruleCard("fa-tv", "Cronograma del Programa", [
      h("p", { class: "muted", style: "margin-bottom:10px" }, "Así se mueve la semana dentro de la granja, día por día."),
      ul([
        h("li", {}, [
          h("strong", {}, "Lunes — Capataz:"),
          " los granjeros compiten en una prueba por diversos beneficios y por ser el capataz de la semana. El capataz no puede ser nominado.",
        ]),
        h("li", {}, [
          h("strong", {}, "Martes — Duelo:"),
          " dos granjeros se enfrentan y el que pierde queda nominado directamente.",
        ]),
        h("li", {}, [h("strong", {}, "Miércoles — Asamblea:"), " los granjeros nominan."]),
        h("li", {}, [h("strong", {}, "Jueves — Salvación:"), " quien gana la salvación se salva."]),
        h("li", {}, [
          h("strong", {}, "Viernes — Traición:"),
          " después de la salvación, quien tiene el poder puede traicionar e intercambiar a un nominado por uno que no lo esté. El intercambiado queda automáticamente en riesgo de eliminación.",
        ]),
        h("li", { style: "margin-bottom:0" }, [
          h("strong", {}, "Domingo — Eliminación:"),
          " los que están en riesgo dan dos nombres de a quién nominan en caso de salir.",
        ]),
      ]),
    ]),

    ruleCard("fa-scale-balanced", "Los dos nombres del domingo", [
      h(
        "p",
        { style: "margin-bottom:10px" },
        "Antes de la eliminación, cada granjero en riesgo deja dos nombres por si le toca salir. Cuál de los dos cuenta depende de la prueba de capataz de la semana siguiente:"
      ),
      ul([
        h("li", {}, [
          "Si el ",
          h("strong", {}, "primer nombre"),
          " gana el puesto de capataz, no puede ser nominado, así que el nominado es el ",
          h("strong", {}, "segundo nombre"),
          ".",
        ]),
        h("li", { style: "margin-bottom:0" }, [
          "En cualquier otro caso, el nominado es el ",
          h("strong", {}, "primer nombre"),
          ".",
        ]),
      ]),
    ]),

    ruleCard("fa-ghost", "El Legado", [
      h("p", { style: "margin-bottom:0" }, [
        "Después de ser expulsado, el granjero eliminado tiene derecho a un último voto llamado ",
        h("strong", {}, "El Legado"),
        ". Ese voto manda a quien elija ",
        h("strong", {}, "directo a nominación"),
        ", sin pasar por la asamblea.",
      ]),
    ]),

    ruleCard("fa-shield-halved", "Capataz, nominados y salvación", [
      ul([
        h("li", {}, "El capataz de la semana gana inmunidad y no puede ser nominado."),
        h("li", {}, "Los nominados se muestran con los puntos con los que fueron nominados en la asamblea."),
        h("li", {}, "Al perdedor del duelo del martes lo verás ya nominado desde antes de la asamblea."),
        h("li", {}, [
          "Si un nominado se salva, sigue apareciendo en la lista con la etiqueta ",
          savedBadge(),
          ", pero ya nadie puede votar por él.",
        ]),
        h("li", { style: "margin-bottom:0" }, "Si hubo traición, el intercambio queda reflejado en la lista de nominados de esa semana."),
      ]),
    ]),
  ];
}

export async function renderReglas(container) {
  const show = getShow();
  const miembro = show.memberSingular;
  const miembros = show.memberPlural.toLowerCase();
  const casa = show.homeLabel;

  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, "Reglas"),

      ruleCard("fa-square-poll-vertical", "Cómo funciona", [
        h("p", { style: "margin-bottom:0" }, [
          "Cada semana eliges, entre los nominados, a quién crees que van a eliminar. ",
          h("strong", {}, "Si le atinas, sumas 1 punto"),
          ". Puedes cambiar tu pick las veces que quieras mientras la votación siga abierta.",
        ]),
      ]),

      ...(isGranja() ? granjaCards() : casaCards()),

      ruleCard("fa-trophy", "Puntaje y Ranking", [
        ul([
          h("li", {}, "El Ranking muestra el puntaje total de todos los jugadores, de mayor a menor."),
          h("li", {}, "Los picks de los demás jugadores se mantienen ocultos hasta que la semana cierra, para que nadie copie el pick de otro."),
          h("li", {}, "Después de cada semana cerrada, el Ranking muestra un feed de quién acertó y quién falló."),
        ]),
      ]),

      ruleCard("fa-shuffle", "Sorteo Ganador", [
        ul([
          h("li", {}, `A cada jugador se le asigna un ${miembro} al azar (sin repetir, salvo que haya más jugadores que ${miembros}). Lo asigna el admin, no se elige.`),
          h("li", {}, `Se ve en tu perfil, dentro de la tarjeta de ${show.seasonLabel}.`),
          h("li", { style: "margin-bottom:0" }, [
            h("strong", {}, `Si ese ${miembro} termina ganando la temporada completa, +3 puntos.`),
          ]),
        ]),
      ]),

      ruleCard("fa-hat-wizard", "El Oráculo", [
        ul([
          h("li", {}, [
            `Mientras El Oráculo esté abierto, arma en esa pestaña tu predicción de todos los ${miembros}: `,
            h("strong", {}, "posición 1 = quién crees que va a GANAR"),
            ", y de ahí hacia abajo en reversa: posición 2 = el último en salir antes de la final, hasta la última posición = quién crees que sale PRIMERO.",
          ]),
          h("li", {}, [
            h("strong", {}, "Por cada posición que aciertes, +1 punto."),
            " El admin cierra El Oráculo cuando decide (y puede reiniciarlo más adelante si hace falta, por ejemplo tras una revelación grande del programa); mientras esté cerrado no se puede cambiar tu orden.",
          ]),
          h("li", { style: "margin-bottom:0" }, `Si algún día salen 2 o más ${miembros} en la misma semana (doble eliminación), cuentan como bloque: no hace falta acertar el orden exacto entre ellos, basta con haber puesto a cualquiera en alguna de las posiciones de esa semana.`),
        ]),
      ]),

      ruleCard("fa-medal", "Insignias", [
        h("p", { class: "muted", style: "margin-bottom:10px" }, "Se calculan solas a partir de tu historial de picks y tus elecciones de perfil."),
        h("ul", { style: "margin:0;padding-left:0;list-style:none;margin-bottom:0" }, [
          badgeRow("racha", "Racha de X", "llevas 3 o más semanas seguidas acertando."),
          badgeRow("ojo", "Ojo de águila", "en algún momento llegaste a una racha de 5 aciertos seguidos."),
          badgeRow("francotirador", "Francotirador", "70% o más de acierto, con al menos 3 semanas votadas."),
          badgeRow("corazon", "Corazón roto", `tu favorito ya fue eliminado de ${casa}.`),
          badgeRow("vidente", "Vidente", `en El Oráculo, pusiste en la posición 1 (ganador) al ${miembro} que efectivamente ganó la temporada.`),
          badgeRow("suertudo", "Suertudo", `el ${miembro} que te tocó al azar en Sorteo Ganador terminó ganando la temporada.`),
          badgeRow("fanatico", "Fanático", "votaste en todas las semanas cerradas de la temporada, sin faltar a ninguna."),
        ]),
      ]),
    ])
  );
}
