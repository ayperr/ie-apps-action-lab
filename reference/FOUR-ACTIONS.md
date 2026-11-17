# Configuración para probar las cuatro acciones

Guía del profesor. Esto prepara las conexiones y su comprobación; no redefine el currículo.

## Primero: comprobar las cuentas

Abre **Plan/Billing** y comprueba que las cuentas utilizadas están en **Trello Free, Resend Free y GitHub Free**, sin una prueba temporal de pago. Revisa también el plan y los límites de tu proyecto Vercel. Guarda una captura de cada pantalla de plan, sin claves ni datos de facturación sensibles. Poder llamar a una API no demuestra qué plan tiene la cuenta.

Usa únicamente cuentas, repositorios y destinos de prácticas propios, con datos ficticios.

## Configuración común en Vercel

En **tu proyecto de la app → Settings → Environment Variables**, configura las variables de [.env.example](../.env.example) en el entorno que vas a probar y después haz **Redeploy**. Son variables del servidor: ninguna lleva el prefijo `NEXT_PUBLIC_`.

| Variable | Valor |
| --- | --- |
| `LAB_ACCESS_KEY` | Clave aleatoria de al menos 24 caracteres; guárdala en tu gestor de contraseñas. |
| `LAB_PREFLIGHT_ENABLED` | `true` únicamente durante la prueba. |

No pegues claves en el chat, archivos del repositorio o capturas. Introdúcelas directamente en Vercel. La clave del laboratorio controla este panel temporal; no equivale a un sistema completo de usuarios para producción.

## 1. Abrir borradores en email y Teams

No requiere una API key, pero sí un cliente de correo configurado o una cuenta de Teams existente con acceso permitido. Un enlace de Teams puede exigir iniciar sesión y respetar las restricciones del tenant de Microsoft.

**Prueba que cuenta:** desde la app, abrir el compositor del cliente externo correcto con el destinatario y texto esperados, sin enviar. Preparar el texto o generar el enlace dentro de la app no demuestra que ese recorrido funciona. En Teams se comprueba el compositor real después del inicio de sesión; no se sustituye por una previsualización interna. Si el login bloquea la apertura, la comprobación sigue pendiente.

**Resultado:** un borrador visible en la aplicación externa. No es un email ni un mensaje enviados; tampoco se afirma persistencia del borrador si no se ha comprobado.

## 2. Crear una tarjeta real en Trello

1. Crea un tablero y una lista de prácticas en tu propio workspace Free. No incorpores a toda la clase a un mismo workspace: el plan Free admite hasta 10 colaboradores por workspace.
2. Abre el [administrador de apps de Trello](https://trello.com/apps/admin), siguiendo el flujo vigente desde octubre de 2026, y obtén la API key de tu integración. No necesitas construir una app visual ni una interfaz con iframe.
3. Autoriza un token con permisos **read y write**, con caducidad de **un día** para esta prueba. El token puede actuar sobre los tableros accesibles de esa cuenta: configurarlo para una lista en la app no limita por sí mismo el permiso del token a esa lista. Usa una cuenta o espacio de prácticas y revócalo al terminar.
4. Identifica el ID de la lista de destino y configura:

| Variable | Valor |
| --- | --- |
| `TRELLO_API_KEY` | API key de la integración. |
| `TRELLO_TOKEN` | Token autorizado de prácticas. |
| `TRELLO_LIST_ID` | ID de la lista propia donde puede crearse la tarjeta. |

**Prueba que cuenta:** crear desde el panel, recuperar la tarjeta y abrir su URL real para comprobar contenido y lista.

## 3. Enviar un email real a tu propia dirección

1. En tu cuenta Resend Free, crea una API key de pruebas con **Full access**. La comprobación utiliza tanto el envío como `GET /emails/{id}`; una clave limitada a enviar puede permitir el envío y rechazar la consulta posterior.
2. Configura `LAB_EMAIL_TO` con **la dirección asociada a tu propia cuenta Resend**. El remitente de prueba es `onboarding@resend.dev`; no permite enviar a cualquier compañero o destinatario real sin verificar un dominio.

| Variable | Valor |
| --- | --- |
| `RESEND_API_KEY` | API key Full access de tu cuenta de prácticas. |
| `LAB_EMAIL_TO` | Tu dirección asociada a esa cuenta Resend. |

**Prueba que cuenta:** confirmación del envío desde la app, ID real del mensaje, consulta de su estado y comprobación de tu bandeja. «Aceptado por Resend» no demuestra recepción. Las direcciones de simulación como `delivered@resend.dev` tampoco prueban que una persona recibió el correo.

## 4. Abrir una PR real en GitHub

1. Elige un repositorio propio de prácticas que contenga la plantilla y su archivo `classroom-fixtures/review-policy.json`. El archivo viene incluido; confirma que existe en la rama configurada.
2. Crea un **fine-grained personal access token**, restringido a ese repositorio, con **Contents: read/write** y **Pull requests: read/write**. Usa caducidad corta y no añadas permisos de administración. GitHub puede incluir automáticamente lectura de metadatos.

| Variable | Valor |
| --- | --- |
| `LAB_GITHUB_TOKEN` | Token restringido al repositorio propio. |
| `LAB_GITHUB_REPOSITORY` | `TU-USUARIO/TU-REPOSITORIO`. |
| `LAB_GITHUB_BASE_BRANCH` | `main`, si es la rama que contiene la plantilla. |
| `LAB_GITHUB_POLICY_PATH` | `classroom-fixtures/review-policy.json`. |

**Prueba que cuenta:** revisar la propuesta, crear rama/commit/PR desde el panel y abrir la URL real para verificar el diff del archivo de prácticas. La PR propone un cambio; no se fusiona automáticamente.

## Ejecutar y cerrar la comprobación

Tras configurar y redesplegar, abre **`/preflight.html` en tu propia app**. Introduce allí la clave del laboratorio, comprueba la configuración y confirma cada acción de prueba por separado. Revisa los destinos antes de confirmar: Trello, email y PR sí crean resultados externos.

Guarda URLs e identificadores de los resultados, sus comprobaciones y cualquier error, sin credenciales. Si aparece un resultado incierto, inspecciona el destino antes de repetir para evitar duplicados. Al terminar, cambia `LAB_PREFLIGHT_ENABLED` a `false`, redespliega y revoca los tokens temporales que ya no necesites.

**Estado previo:** existe una prueba directa mediante Node que creó y verificó una PR #13 en un repositorio privado. Eso no valida el botón de la app ni acredita un plan Free. Las pruebas anteriores con ntfy tampoco validan estas cuatro acciones. Trello, email y el recorrido web se darán por comprobados únicamente cuando observemos sus resultados respectivos.
