# Quiniela Mundial 2026 — Tracker

Tabla en vivo de la quiniela familiar del Mundial 2026. Archivo estático único (`index.html`), sin build step.

## Cómo funciona
- Cada participante tiene un roster fijo de 5 equipos (definido en `PARTICIPANTS` dentro de `index.html`).
- Los puntos se calculan según:
  - **Fase de grupos:** victoria 3 pts, empate 1 pt, derrota 0 pts, +1 pt extra por clasificar a eliminatorias.
  - **Eliminatorias:** victoria en tiempo regular 3 pts, victoria en tiempo extra/penales 2 pts, derrota en tiempo extra/penales 1 pt, derrota en tiempo regular 0 pts, +1 pt extra por llegar a cuartos de final.
- Los equipos eliminados se muestran en gris automáticamente.
- Los resultados se traen de la API de [football-data.org](https://www.football-data.org/) (competición `WC`).

## Uso
1. Abre `index.html` (localmente o publicado en Netlify/GitHub Pages).
2. Despliega el panel **⚙️ Configuración**, pega tu API key gratuita de football-data.org y presiona **Guardar key**.
   - La key se guarda solo en `localStorage` de tu navegador — nunca se escribe en el archivo ni se sube al repositorio.
   - Cada persona que abra el sitio (Lorena, etc.) necesita pegar la key una sola vez en su propio navegador para que el botón "Actualizar resultados" funcione ahí.
3. Presiona **Actualizar resultados** (o activa "Auto-actualizar cada 10 min").

## Si el API falla o un equipo no se detecta bien
Abre el panel **🛠️ Ajustes manuales por equipo** y fuerza el estado ("Eliminado"/"Activo") o los puntos de cualquier equipo. Los ajustes manuales siempre tienen prioridad sobre el cálculo automático y también se guardan en `localStorage`.

El panel **🔍 Datos crudos del último fetch** muestra el JSON tal cual lo devuelve la API — útil para revisar los nombres exactos de equipo/fase si el matching automático falla.

## Deploy
Es un sitio 100% estático. Para Netlify o GitHub Pages: sube el repo y apunta el build a la raíz (no requiere build command ni variables de entorno).
