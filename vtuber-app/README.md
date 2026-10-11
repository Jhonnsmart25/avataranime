# Nova: asistente virtual (PWA)

App instalable en Android. Chat de texto y voz (te escucha y te contesta hablando), con avatar provisional.

## Probar en tu computadora
```
ANTHROPIC_API_KEY=tu_llave node server.js     # respuestas reales
MOCK=1 node server.js                         # prueba sin llave
```
Abre http://localhost:3000. Requiere Node 18 o más nuevo. No hay dependencias que instalar.

## Instalar en tu celular Android
Android solo permite instalar una PWA si la página está en **HTTPS**, así que hay que subirla a internet:

1. Sube esta carpeta a un hosting con Node. Opciones sencillas: Render, Railway o Fly.io (conectas el repositorio de GitHub).
2. Comando de inicio: `node server.js`.
3. Variable de entorno: `ANTHROPIC_API_KEY` (tu llave de la API de Claude; nunca va en el código ni en el navegador).
4. Abre la URL https que te dé el hosting en **Chrome para Android**.
5. Menú ⋮ → **Instalar app** (o toca el botón "Instalar app" dentro de la página). Queda con ícono y pantalla completa.
6. Al usar el micrófono por primera vez, acepta el permiso.

Nota: el reconocimiento de voz de Chrome necesita internet, y la app también para platicar.

## Estructura
- `server.js`: servidor y conexión con Claude (la llave vive aquí).
- `persona.js`: nombre y personalidad de la asistente.
- `public/`: la app (HTML, estilos, lógica, manifest, service worker, íconos).

## Siguientes pasos
- Login (Supabase o Firebase Auth) y cobro por días con Stripe; ahora el único límite es de 12 mensajes por minuto por IP.
- Reemplazar el avatar provisional por tu personaje original en Live2D.
- Voz más natural (ElevenLabs u OpenAI TTS).
