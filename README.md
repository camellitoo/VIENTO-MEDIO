# Viento medio

Pronóstico de viento para wingfoil en tres spots. La web es estática, cabe en el móvil y se puede instalar en la pantalla de inicio del iPhone. Todo el texto de la aplicación está en español.

Cada hora se guarda la **media aritmética de la velocidad del viento a 10 m, en nudos**, entre las fuentes que hayan respondido. Si una falla, el promedio usa las demás y la pantalla enseña `2/3` o `1/3`. Si no hay ninguna, pone «sin dato». No se inventan valores.

## Spots

| Spot | Lugar | Coordenadas que usa el pronóstico |
| --- | --- | --- |
| Malgrat de Mar | Playa de La Pomareda, Maresme | 41.64424° N, 2.74935° E |
| Barcarés | Playa de Les Dosses, Pirineos Orientales | 42.83733193° N, 3.02343965° E |
| Orzales | Orilla del embalse del Ebro, Campoo de Yuso | 43.0005° N, 4.0698° O |

Orzales no es playa de mar. Es el spot de wingfoil del pantano, junto a las ruinas del aeródromo de Orzales. Esas coordenadas son las del punto publicado para el spot y coinciden con ese paraje.

En la costa se pide la celda de mar más cercana del modelo. En Orzales se pide la celda de tierra, para no saltar al Cantábrico. París y Madrid llevan el mismo reloj, así que la franja de 09:00 a 20:00 es la hora local en los tres sitios.

## Cómo se lee

Un día sale en naranja, con la etiqueta **Buen viento**, cuando la media **supera 10 nudos durante al menos 3 horas seguidas** entre las **09:00 y las 20:00** inclusive. Esas horas llevan la etiqueta **suma**. Un valor de 10,0 no llega. Una hora suelta por encima de 10, o dos seguidas, no marcan el día. Una hora sin dato rompe la racha.

La flecha apunta hacia donde sopla el viento. Las letras (N, SO, O…) dicen de dónde viene. La temperatura es la máxima y la mínima del día. El tiempo es el estado más repetido entre las 09:00 y las 20:00.

## De dónde salen los números

Windguru, Windy y Windfinder no se consultan. Windguru prohíbe descargar la web con scripts. La API de Windy exige una clave y no queremos secretos en el repositorio. Windfinder no permite reutilizar sus datos en otra página, y su Superforecast es un modelo privado.

Cada hueco usa el modelo abierto más parecido, pedido a [Open-Meteo](https://open-meteo.com/) sin clave:

| Hueco | Modelo real | Por qué |
| --- | --- | --- |
| Windguru | GFS de NOAA (`gfs_seamless`) | Es el modelo clásico que Windguru enseña desde hace años. |
| Windy | ECMWF IFS (`ecmwf_ifs`) | Windy abre por defecto en ECMWF. Open-Meteo publica ese IFS. |
| Windfinder | ICON-EU de DWD (`icon_eu`) | Es el modelo europeo de alta resolución que Windfinder muestra junto a su modelo privado. Suele cubrir unos cinco días; después la media sigue con las otras fuentes y verás `2/3`. |

La dirección es la media circular de las fuentes con viento, no una media de los grados a secas. La velocidad no se sustituye por el módulo del vector: si una fuente dice norte y otra sur, la media de los nudos se conserva y la dirección se deja en blanco si se anulan.

## Actualización

Un workflow de GitHub Actions descarga el pronóstico de los próximos 7 días tres veces al día, hacia las **08:00, 16:00 y 00:00** hora de Madrid. El cron de GitHub va en UTC y a menudo arranca varias horas más tarde, así que hay dos horarios por toma (verano e invierno) y el script no exige que en Madrid sea exactamente esa hora. Mira `generatedAt` en `data/forecast.json` y vuelve a descargar si el archivo tiene unas 6 horas o más: el intervalo previsto es de 8 horas, con 2 horas de margen para no repetir la toma cuando el otro cron de la misma franja arranca poco después. Un lanzamiento manual siempre descarga, aunque el archivo sea reciente: pestaña Actions, workflow **Pronóstico**, botón **Run workflow**.

El resultado se guarda en `data/forecast.json` y la web lo lee. La cabecera dice cuándo se generó.

## Webcam de Barcarés

En Barcarés hay un botón, **Ver la playa en directo**. Abre la webcam pública de Les Dosses que publica [Skaping](https://www.skaping.com/le-barcares/dosses). Su reproductor admite ir dentro de otra página (añade la clase `in-frame` y no envía `X-Frame-Options`). Si el recuadro no carga, el enlace abre la misma cámara en Skaping.

## Añadirla a la pantalla de inicio del iPhone

1. Abre **Safari** (tiene que ser Safari) y entra en <https://camellitoo.github.io/viento-medio/>.
2. Pulsa el botón **Compartir** (el cuadrado con la flecha hacia arriba).
3. Baja y elige **Añadir a pantalla de inicio**.
4. Deja el nombre **Viento medio** y pulsa **Añadir**.

El icono abre la app a pantalla completa, sin la barra de Safari.

## Publicar en GitHub Pages

El workflow **Páginas** despliega el sitio en cada push a `main`. GitHub no deja que el token del workflow cree el sitio la primera vez (`Resource not accessible by integration`), así que hay que elegir el origen a mano una sola vez:

1. Abre <https://github.com/camellitoo/viento-medio/settings/pages>.
2. En **Build and deployment**, en **Source**, elige **GitHub Actions**.
3. Si la primera ejecución de **Páginas** o **Pronóstico** salió en rojo antes de ese cambio, entra en **Actions**, abre la ejecución y pulsa **Re-run all jobs**.
4. La dirección queda en <https://camellitoo.github.io/viento-medio/>.

No hace falta elegir una rama ni una carpeta: el workflow prepara el sitio y lo publica.

## Probar en local

```bash
node --test
node scripts/fetch-forecast.js
python3 -m http.server 8765
```

Abre <http://127.0.0.1:8765/>. Los casos sintéticos del resalte están en `test/` y también se pueden ver en `test/preview.html`.

## Atribución

Datos meteorológicos de [Open-Meteo](https://open-meteo.com/) (CC BY 4.0), a partir de GFS (NOAA), IFS (ECMWF) e ICON-EU (DWD).
