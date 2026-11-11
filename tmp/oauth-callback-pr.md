El callback de autenticación construía la redirección con la dirección interna de Next.js detrás del proxy de Railway, por lo que el navegador terminaba en https://0.0.0.0:3000. Ahora utiliza NEXT_PUBLIC_SITE_URL mediante el helper existente y conserva la validación del destino relativo.

Validación: siete pruebas del callback y la URL pública aprobadas; TypeScript y ESLint aprobados. Las pruebas cubren el intercambio de sesión, los enlaces incompletos, la confirmación de correo y el rechazo de destinos externos.
