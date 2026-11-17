# Configuración para probar las cuatro acciones

Guía del profesor y de quien configure su propia copia. Las cuatro acciones ya están implementadas: **email → Supabase → Trello → GitHub**. El alumno copia, despliega, personaliza el diseño/caso y conecta sus cuentas; no construye cuatro APIs desde cero. El calentamiento de borradores de email y Teams va antes de los cuatro ejercicios.

Dedica los primeros **35 minutos** a copiar y personalizar, después **email 30 min**, **Supabase 35 min**, **Trello 30 min** y **GitHub 30 min**, más **10 min de descanso** y **10 min de cierre**: **180 minutos**. La interfaz, los datos y los botones funcionan al clonar. Se puede abrir el preview y confirmar: si faltan valores del proveedor, la app muestra las variables que hay que configurar y no llama al servicio.

Se puede usar un dataset de una clase anterior o el caso ficticio incluido. Si cambia el registro de acción, el asistente debe actualizar de forma coherente la interfaz, el registro y los previews del servidor, y el fixture/función de Supabase. Cambiar solo etiquetas no cambia lo que se envía. NS-1041 queda como alternativa preparada.

## Primero: comprobar las cuentas

Revisa el plan y los límites de tus cuentas de Resend, Supabase, Trello, GitHub y Vercel antes del taller. Las pantallas de facturación de las cuentas usadas en las pruebas no se han inspeccionado: que una acción funcione no certifica un plan Free ni la cuota disponible. Usa los planes gratuitos cuando estén disponibles para tu cuenta.

Usa únicamente cuentas, repositorios y destinos de prácticas propios, con datos ficticios.

## Configuración común en Vercel

En **tu proyecto de la app → Settings → Environment Variables → Production**, configura las variables de [.env.example](../.env.example) en el entorno que vas a probar y después entra en **Deployments → último despliegue → Redeploy**. Son variables del servidor: ninguna lleva el prefijo `NEXT_PUBLIC_`.

| Variable | Valor |
| --- | --- |
| `LAB_ACCESS_KEY` | Antes de añadir credenciales de proveedores, guarda una contraseña aleatoria de al menos 32 caracteres en tu gestor de contraseñas y en Vercel. Protege las operaciones reales cuando el servicio está configurado. |

No hay un flag de activación. Puedes pulsar los botones antes de configurar las conexiones: al confirmar, un error claro identifica las variables ausentes, por ejemplo `RESEND_API_KEY` y `LAB_EMAIL_TO`. Si están presentes pero tienen un formato inválido, indica qué ajustes revisar. Añade o corrige esos valores en Vercel, guarda, redespliega y vuelve a probar. Para operar con un proveedor ya configurado, introduce la contraseña en **Lab access phrase**.

No pegues claves en el chat, archivos del repositorio o capturas. Introdúcelas directamente en Vercel. La clave del laboratorio controla este panel temporal; no equivale a un sistema completo de usuarios para producción.

## Calentamiento · Abrir borradores en email y Teams

No requiere una API key, pero sí un cliente de correo configurado o una cuenta de Teams existente con acceso permitido. Un enlace de Teams puede exigir iniciar sesión y respetar las restricciones del tenant de Microsoft.

**Prueba que cuenta:** desde la app, abrir el compositor del cliente externo correcto con el destinatario y texto esperados, sin enviar. Preparar el texto o generar el enlace dentro de la app no demuestra que ese recorrido funciona. En Teams se comprueba el compositor real después del inicio de sesión; no se sustituye por una previsualización interna. Si el login bloquea la apertura, la comprobación sigue pendiente.

**Resultado:** un borrador visible en la aplicación externa. No es un email ni un mensaje enviados; tampoco se afirma persistencia del borrador si no se ha comprobado.

## 1 · Email: enviarte un mensaje real · 30 min

1. En tu cuenta Resend Free, crea una API key de pruebas con **Full access**. La comprobación utiliza tanto el envío como `GET /emails/{id}`; una clave limitada a enviar puede permitir el envío y rechazar la consulta posterior.
2. Configura `LAB_EMAIL_TO` con **la dirección asociada a tu propia cuenta Resend**. El remitente de prueba es `onboarding@resend.dev`; no permite enviar a cualquier compañero o destinatario real sin verificar un dominio.

| Variable | Valor |
| --- | --- |
| `RESEND_API_KEY` | API key Full access de tu cuenta de prácticas. |
| `LAB_EMAIL_TO` | Tu dirección asociada a esa cuenta Resend. |

**Prueba que cuenta:** confirmación del envío desde la app, ID real del mensaje, consulta de su estado y comprobación de tu bandeja. «Aceptado por Resend» no demuestra recepción. Las direcciones de simulación como `delivered@resend.dev` tampoco prueban que una persona recibió el correo.

## 2 · Supabase: guardar una revisión · 35 min

Esta conexión necesita una tabla y una función además de la URL. **La plantilla incluye los archivos; no crea el proyecto ni despliega la función automáticamente.** Prepara esta parte con el profesor o el asistente. El caso incluido guarda únicamente NS-1041.

1. Crea o selecciona **tu propio proyecto de prácticas** en [Supabase](https://supabase.com/dashboard). En **SQL Editor**, ejecuta una sola vez [supabase/setup.sql](../supabase/setup.sql). Crea la tabla `ie_action_lab_reviews`, con el registro ficticio y acceso restringido al servidor. No repitas el script si la tabla ya existe.
2. Abre [supabase/writeback/index.ts](../supabase/writeback/index.ts) con tu asistente. El marcador `EXPECTED_ACCESS_KEY_SHA256` necesita la huella SHA-256 de **tu propia** `LAB_ACCESS_KEY` de al menos **32 caracteres**. El asistente o profesor debe calcularla mediante una herramienta local o acceso autorizado a tus ajustes. No pegues el secreto en el chat: solo su huella sustituye al marcador. No hay un botón incluido que automatice este paso.
3. En **Edge Functions**, despliega el archivo con el nombre exacto **`ie-action-lab-writeback`**. La plantilla comprueba su propia clave: despliega con **Verify JWT desactivado** únicamente manteniendo intacta esa comprobación y con la huella configurada. El profesor o asistente debe revisar este paso. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` se utilizan dentro del servidor de Supabase; la clave de servicio no se copia al navegador.
4. Añade la URL de tu proyecto en Vercel y conserva la misma clave del laboratorio usada para la huella. Guarda y redespliega la app.

| Variable en Vercel | Valor |
| --- | --- |
| `LAB_SUPABASE_URL` | URL de tu proyecto, como `https://TU_PROYECTO.supabase.co`, sin ruta ni barra final. |
| `LAB_ACCESS_KEY` | La contraseña de al menos 32 caracteres cuya huella has configurado en la función. |

Petición para el asistente, con tu copia del repositorio abierta:

> Ayúdame a configurar mi propio Supabase con supabase/setup.sql y supabase/writeback/index.ts. Explícame qué pantalla abrir y qué archivo usar. Mantén la comprobación de acceso y prepara la huella de mi clave por un canal local o autorizado; no me pidas pegar secretos en el chat. Comprueba la tabla y la función desplegada. Si no tienes acceso al proyecto o a los ajustes, indícame la operación concreta que debo realizar. No des la conexión por terminada solo por guardar la URL.

**Ejercicio:** confirmar que la revisión del registro se guarda fuera del navegador.

**Comprobación:** recargar la app, introducir de nuevo la frase del laboratorio y pulsar **Read saved review again**. Deben reaparecer el estado, el ID de petición y la fecha guardados. Como comprobación independiente, abre `ie_action_lab_reviews` en **Table Editor** y localiza NS-1041. La clase del profesor también comprobó la escritura con una lectura SQL.

## 3 · Trello: crear una tarea de revisión · 30 min

1. Crea un tablero y una lista de prácticas en tu propio workspace Free. No incorpores a toda la clase a un mismo workspace: el plan Free admite hasta 10 colaboradores por workspace.
2. Abre el [administrador de apps de Trello](https://trello.com/apps/admin), crea una app y elige **My app doesn't use Power-up capabilities**. Completa el nombre **IE Action Lab**, tu **Workspace** y los campos de **email** solicitados.
3. Entra en la pestaña **Trello Auth** y pulsa **Generate a new Trello Auth API key for this app**. Guarda la API key directamente en Vercel como `TRELLO_API_KEY`.
4. Pulsa **Token**. Comprueba la cuenta, los permisos **read y write** y la duración mostrada; después pulsa **Allow**. Guarda el token que aparece directamente en Vercel como `TRELLO_TOKEN`.
5. Identifica la lista de destino: crea una tarjeta temporal en esa lista, ábrela y añade `.json` al final de su URL. Busca `idList` y copia su valor sin comillas como `TRELLO_LIST_ID`. Ese es el ID de la lista; no uses el ID de la tarjeta.

**La ruta es Trello Auth, no OAuth 2.0.** Solo necesitas la **API key** y el **Token**: este flujo manual no utiliza Secret, Client ID, callback ni Allowed origins. Si ya existe la app, empieza en su pestaña Trello Auth.

Para el taller es preferible una autorización de un día; si el enlace Token ofrece otra duración, revisa el permiso antes de aceptarlo y pide ayuda para cambiarlo. El token puede actuar sobre los tableros accesibles de la cuenta, aunque la app tenga una única lista configurada. Revócalo al terminar. [Documentación oficial de autorización](https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/).

| Variable | Valor |
| --- | --- |
| `TRELLO_API_KEY` | API key generada en la pestaña Trello Auth. |
| `TRELLO_TOKEN` | Token mostrado después de pulsar Allow. |
| `TRELLO_LIST_ID` | ID de la lista propia donde puede crearse la tarjeta. |

**Prueba que cuenta:** crear desde el panel, recuperar la tarjeta y abrir su URL real para comprobar contenido y lista. Guardar la API key y el token solo prepara la conexión; no demuestra todavía que la creación funcione.

## 4 · GitHub: proponer un cambio mediante una PR · 30 min

1. Elige un repositorio propio de prácticas que contenga la plantilla y su archivo `classroom-fixtures/review-policy.json`. El archivo viene incluido; confirma que existe en la rama configurada.
2. Abre [crear el token de prácticas en GitHub](https://github.com/settings/personal-access-tokens/new?name=IE%20Action%20Lab&expires_in=7&contents=write&pull_requests=write). El enlace preselecciona el nombre, una caducidad de siete días y los dos permisos. En **Resource owner**, elige tu propia cuenta.
3. En **Repository access**, marca **Only select repositories** y selecciona tu propia copia de la plantilla, aunque sea pública. **Public repositories** solo permite lectura y no sirve para crear esta PR.
4. En **Permissions**, pulsa el **+ junto a Repository**, no el de Account. Añade o comprueba **Contents → Read and write** y **Pull requests → Read and write**. **Metadata: Read-only** se incluye automáticamente; no necesitas permisos de administración.
5. Genera el token y guárdalo directamente en Vercel como `LAB_GITHUB_TOKEN`. Configura también el nombre de tu propio repositorio y redespliega antes de probar.

| Variable | Valor |
| --- | --- |
| `LAB_GITHUB_TOKEN` | Token restringido a tu propia copia, seleccionada con Only select repositories. |
| `LAB_GITHUB_REPOSITORY` | `TU-USUARIO/TU-REPOSITORIO`. |
| `LAB_GITHUB_BASE_BRANCH` | `main`, si es la rama que contiene la plantilla. |
| `LAB_GITHUB_POLICY_PATH` | `classroom-fixtures/review-policy.json`. |

**Prueba que cuenta:** revisar la propuesta, crear rama/commit/PR desde el panel y abrir la URL real para verificar el diff del archivo de prácticas. La PR propone un cambio; no se fusiona automáticamente. El archivo de política es didáctico: modificarlo todavía no cambia por sí solo las reglas del dashboard. Tener el token configurado todavía no demuestra que la prueba de tu propia copia haya funcionado.

## Ejecutar y cerrar la comprobación

Tras configurar y redesplegar, abre **`/preflight.html` en tu propia app**. Introduce allí la clave del laboratorio, comprueba la configuración y confirma cada acción de prueba por separado. Sigue **email → Supabase → Trello → GitHub**. Revisa cada destino antes de confirmar: los cuatro ejercicios producen cambios fuera del navegador. Check configured services solo comprueba la configuración; no ejecuta acciones.

Guarda URLs e identificadores de los resultados, sus comprobaciones y cualquier error, sin credenciales. Si aparece un resultado incierto, inspecciona el destino antes de repetir para evitar duplicados. Al terminar, borra la frase del laboratorio del campo de la página y revoca los tokens temporales que ya no necesites. Las operaciones con proveedores configurados siguen protegidas por la contraseña del laboratorio.

## Evidencia de las pruebas reales

El **17 de noviembre de 2026** se comprobaron las cuatro acciones en la app configurada del profesor:

| Acción | Comprobación realizada |
| --- | --- |
| Email | Estado del proveedor y recepción confirmada en la bandeja del destinatario. |
| Supabase | Escritura y lectura independiente del registro mediante SQL. |
| Trello | Creación, lectura y comprobación de la [tarjeta N3nb8mnq](https://trello.com/c/N3nb8mnq). |
| GitHub | Creación y verificación desde la interfaz de la [PR #1](https://github.com/josncmar/ie-apps-action-lab/pull/1). |

Esto valida esa configuración del profesor, no las cuentas de cada alumno ni sus planes. Cada copia debe comprobar sus propios resultados. El calentamiento de borradores depende además del cliente externo de cada persona.

La notificación **ntfy** del dashboard queda como **demostración extra opcional**. No forma parte de los cuatro ejercicios y su recepción no valida email, Supabase, Trello ni GitHub. Su modo de práctica es simulación local.
