/**
 * Tres huecos de pronóstico. Los nombres comerciales (Windguru, Windy,
 * Windfinder) no se consultan: sus condiciones prohíben la descarga
 * automática o exigen una clave que no va en el repositorio. Cada hueco
 * usa el modelo abierto más fiel, servido por Open-Meteo.
 */
export const SOURCES = [
  {
    id: "gfs",
    slot: "windguru",
    model: "gfs_seamless",
    name: "GFS",
    provider: "NOAA",
    via: "Open-Meteo",
    slotLabel: "Windguru",
    reason:
      "Windguru prohíbe descargar la web con scripts y no tiene un API público de pronóstico. GFS es el modelo clásico que Windguru muestra desde hace años.",
  },
  {
    id: "ecmwf",
    slot: "windy",
    model: "ecmwf_ifs",
    name: "ECMWF IFS",
    provider: "ECMWF",
    via: "Open-Meteo",
    slotLabel: "Windy",
    reason:
      "La API de Windy exige una clave y sus condiciones prohíben el rastreo automático. Su modelo por defecto es ECMWF; Open-Meteo publica el IFS de ECMWF.",
  },
  {
    id: "icon",
    slot: "windfinder",
    model: "icon_eu",
    name: "ICON-EU",
    provider: "DWD",
    via: "Open-Meteo",
    slotLabel: "Windfinder",
    reason:
      "Windfinder no permite usar sus datos en otra web. Su Superforecast es un modelo privado. ICON-EU es el modelo europeo de alta resolución que también enseña, y cubre unos cinco días.",
  },
];

export const SPOTS = [
  {
    id: "malgrat",
    name: "Malgrat de Mar",
    shortName: "Malgrat",
    area: "Maresme, Cataluña",
    detail: "Playa de La Pomareda",
    latitude: 41.64424,
    longitude: 2.74935,
    timezone: "Europe/Madrid",
    cellSelection: "sea",
    cellNote: "Se pide la celda de mar más cercana a la playa.",
    webcam: null,
  },
  {
    id: "barcares",
    name: "Barcarés",
    shortName: "Barcarés",
    area: "Pirineos Orientales, Francia",
    detail: "Playa de Les Dosses",
    latitude: 42.83733193,
    longitude: 3.02343965,
    timezone: "Europe/Paris",
    cellSelection: "sea",
    cellNote: "Se pide la celda de mar más cercana a la playa.",
    webcam: {
      title: "Webcam de Les Dosses",
      provider: "Skaping",
      pageUrl: "https://www.skaping.com/le-barcares/dosses",
      embedUrl: "https://www.skaping.com/le-barcares/dosses",
    },
  },
  {
    id: "orzales",
    name: "Orzales",
    shortName: "Orzales",
    area: "Campoo de Yuso, Cantabria",
    detail: "Orilla del embalse del Ebro",
    latitude: 43.0005,
    longitude: -4.0698,
    timezone: "Europe/Madrid",
    cellSelection: "land",
    cellNote: "No es mar: es la orilla del embalse. Se pide la celda de tierra más cercana.",
    webcam: null,
  },
];

export const SOURCE_COUNT = SOURCES.length;
