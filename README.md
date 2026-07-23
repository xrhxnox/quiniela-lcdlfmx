# Quiniela — La Casa de los Famosos México T4

Web para llevar la quiniela de eliminación entre amigos: cada semana los jugadores
eligen a quién creen que van a eliminar entre los nominados, suman puntos si le
atinan, y hay tablas de ranking y de eliminados históricos.

Es una página estática (sin servidor propio) que usa **Supabase** como base de
datos y sistema de cuentas, y se aloja gratis en **GitHub Pages**.

## 1. Crear el proyecto de Supabase

1. Ve a [supabase.com](https://supabase.com), crea una cuenta gratis y un proyecto nuevo.
2. En el proyecto, abre **SQL Editor** → **New query**, pega todo el contenido de
   [`sql/schema.sql`](sql/schema.sql) y dale **Run**. Esto crea las tablas, la
   seguridad (RLS), las vistas de ranking y el storage para fotos.
3. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public key**
4. Abre [`js/config.js`](js/config.js) en este repo y pega esos dos valores en
   `SUPABASE_URL` y `SUPABASE_ANON_KEY`.

## 2. Crear tu cuenta de administrador

1. En Supabase, ve a **Authentication → Users → Add user**.
2. Como correo pon `tuusuario@lcdlfmx.app` (puede ser cualquier "usuario", no
   necesita ser un correo real) y ponle una contraseña. Desmarca pedir
   confirmación de correo si te lo pregunta.
3. En **SQL Editor**, corre (cambiando `tuusuario`):
   ```sql
   update public.profiles set role = 'admin' where username = 'tuusuario';
   ```
4. Repite el paso "Add user" para cada participante de la quiniela, con su
   propio `usuario@lcdlfmx.app` y contraseña. Ellos entrarán a la página solo
   con la parte de "usuario" (sin el `@lcdlfmx.app`).

## 3. Publicar en GitHub Pages

1. Sube esta carpeta a un repositorio de GitHub.
2. En el repo, ve a **Settings → Pages**, y en "Build and deployment" elige
   **Deploy from a branch**, rama `main` y carpeta `/ (root)`.
3. En un par de minutos tu quiniela estará en
   `https://tu-usuario.github.io/tu-repo/`.

## 4. Uso semanal (como admin)

Entra con tu cuenta y ve a la pestaña **Admin**:

- **Semanas**: crea la semana (número + fecha de eliminación) y marca quién es
  el **líder de la semana** (inmunidad) — normalmente se anuncia el lunes.
  El miércoles agrega a los **nominados** con los puntos con los que fueron
  nominados y dale **Abrir votación** para que los jugadores puedan elegir.
  El viernes, si alguno de los nominados gana la salvación, márcalo con el
  botón de escudo junto a su nombre: sigue apareciendo en la lista pero con
  la etiqueta "Salvado" y ya nadie puede votar por él.
- El día de la eliminación, entra otra vez, selecciona quién fue eliminado y
  dale **Confirmar eliminación y cerrar semana**. Esto guarda el resultado,
  cierra la votación, actualiza el ranking automáticamente y marca al
  eliminado como inactivo.
- **Participantes**: agrega a los habitantes de la casa con foto, nombre y
  cuarto. Aquí también puedes marcarlos como eliminados manualmente si hace
  falta.
- **Usuarios**: solo permite cambiar el nombre para mostrar o dar/quitar
  permisos de admin a alguien. Las cuentas nuevas se crean desde el panel de
  Supabase (paso 2).

## Estructura del proyecto

```
index.html          shell de la app
css/styles.css       estilos
js/config.js          credenciales de Supabase (edítalo tú)
js/supabaseClient.js  cliente de Supabase
js/auth.js             login/logout
js/data.js              todas las consultas a la base de datos
js/utils.js             helpers de UI
js/main.js              router y navegación
js/views/                cada pantalla (votar, ranking, eliminados, participantes, admin)
sql/schema.sql         esquema completo de la base de datos
assets/logo.png         logo del programa
```

## Notas

- No se necesita build ni instalar dependencias: todo corre directo en el
  navegador con módulos JS nativos.
- Los "puntos de nominación" que se muestran junto a cada nominado son
  informativos (cuántos votos/puntos recibió al ser nominado); el punto que
  suma cada jugador en el ranking es por **acertar quién sale eliminado**.
- Los picks de los demás jugadores permanecen ocultos hasta que la semana se
  cierra, para que nadie copie el pick de otro antes de la eliminación.
