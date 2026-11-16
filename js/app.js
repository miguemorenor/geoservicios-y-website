// Crear el mapa centrado en el Huila.
const map = L.map("map").setView([2.5359, -75.5277], 8);

const CODIGO_HUILA = "41";
const fuenteDANE =
  "DANE — Departamento Administrativo Nacional de Estadística";

// Mapa base.
const osm = L.tileLayer(
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
).addTo(map);

// Escala.
L.control.scale({
  metric: true,
  imperial: false
}).addTo(map);

// Orden de las capas.
// Las capas adicionales quedan encima del departamento.
map.createPane("municipios");
map.getPane("municipios").style.zIndex = 410;

map.createPane("tematicas");
map.getPane("tematicas").style.zIndex = 420;

// Control de capas.
const controlCapas = L.control.layers(
  { "OpenStreetMap": osm },
  {},
  { collapsed: true }
).addTo(map);

const capasRegistradas = [];
let departamentosGeoJSON;
let estado = "Cargando el departamento del Huila…";

// Panel de información.
const info = L.control({ position: "topleft" });

info.onAdd = function () {
  this.contenedor = L.DomUtil.create("div", "info");
  L.DomEvent.disableClickPropagation(this.contenedor);
  this.update();
  return this.contenedor;
};

info.update = function (propiedades) {
  this.contenedor.replaceChildren();

  const titulo = document.createElement("h4");
  titulo.textContent = "Huila — Visor geográfico";

  const detalle = document.createElement("div");
  detalle.textContent = propiedades
    ? `${propiedades.dpto_cnmbr ?? "HUILA"} · Código: ${
        propiedades.dpto_ccdgo ?? CODIGO_HUILA
      }`
    : estado;

  this.contenedor.append(titulo, detalle);
};

info.addTo(map);

// Leyenda sin imágenes de GeoServer.
const leyenda = L.control({ position: "bottomright" });

leyenda.onAdd = function () {
  this.contenedor = L.DomUtil.create("div", "info legend");

  L.DomEvent.disableClickPropagation(this.contenedor);
  L.DomEvent.disableScrollPropagation(this.contenedor);

  this.update();
  return this.contenedor;
};

leyenda.update = function () {
  this.contenedor.replaceChildren();

  const titulo = document.createElement("h4");
  titulo.textContent = "Leyenda";
  this.contenedor.append(titulo);

  const agregarFila = (nombre, color, punto) => {
    const fila = document.createElement("div");
    fila.className = "legend-row";

    const simbolo = document.createElement("span");

    if (punto) {
      simbolo.style.cssText =
        "display:inline-block;width:9px;height:9px;" +
        "border-radius:50%;flex-shrink:0;";
      simbolo.style.backgroundColor = color;
    } else {
      simbolo.className = "legend-line";
      simbolo.style.borderColor = color;
      simbolo.style.flexShrink = "0";
    }

    const texto = document.createElement("span");
    texto.textContent = nombre;

    fila.append(simbolo, texto);
    this.contenedor.append(fila);
  };

  capasRegistradas.forEach(function (registro) {
    if (map.hasLayer(registro.capa)) {
      agregarFila(
        registro.nombre,
        registro.color,
        registro.punto
      );
    }
  });

  if (
    departamentosGeoJSON &&
    map.hasLayer(departamentosGeoJSON)
  ) {
    agregarFila("Departamento resaltado", "#ff7800", false);
  }

  const fuente = document.createElement("div");
  fuente.style.fontSize = "11px";
  fuente.style.marginTop = "8px";
  fuente.textContent = "Límites administrativos: DANE";

  this.contenedor.append(fuente);
};

leyenda.addTo(map);

map.on("overlayadd overlayremove", function () {
  leyenda.update();
  info.update();
});

// Registrar una capa en el selector y la leyenda.
function registrarCapa(capa, nombre, color, punto, visible) {
  capasRegistradas.push({
    capa: capa,
    nombre: nombre,
    color: color,
    punto: punto
  });

  controlCapas.addOverlay(capa, nombre);

  if (visible) {
    capa.addTo(map);
  }

  leyenda.update();
}

// Leer un archivo GeoJSON del repositorio.
async function leerGeoJSON(ruta) {
  const respuesta = await fetch(ruta);

  if (!respuesta.ok) {
    throw new Error(
      ruta + " — Error HTTP: " + respuesta.status
    );
  }

  const datos = await respuesta.json();

  if (
    datos.type !== "FeatureCollection" ||
    !Array.isArray(datos.features) ||
    datos.features.length === 0
  ) {
    throw new Error("GeoJSON vacío o inválido: " + ruta);
  }

  return datos;
}

// Seleccionar únicamente entidades del Huila.
function seleccionarHuila(datos) {
  const entidades = datos.features.filter(function (feature) {
    return (
      String(feature.properties?.dpto_ccdgo ?? "").trim() ===
      CODIGO_HUILA
    );
  });

  if (entidades.length === 0) {
    throw new Error(
      "No se encontraron entidades con dpto_ccdgo = 41."
    );
  }

  return {
    type: "FeatureCollection",
    features: entidades
  };
}

// Crear una ventana de atributos sin interpretar HTML.
function crearPopup(titulo, propiedades) {
  const contenido = document.createElement("div");
  contenido.style.maxHeight = "220px";
  contenido.style.overflowY = "auto";

  const encabezado = document.createElement("strong");
  encabezado.textContent = titulo;
  contenido.append(encabezado);

  Object.entries(propiedades).forEach(function ([campo, valor]) {
    if (valor === null || valor === undefined || valor === "") {
      return;
    }

    const fila = document.createElement("div");
    fila.textContent = campo + ": " + String(valor);
    contenido.append(fila);
  });

  return contenido;
}

// Agregar una etiqueta al pasar el cursor.
function agregarEtiqueta(layer, texto) {
  if (texto === null || texto === undefined) {
    return;
  }

  const etiqueta = String(texto).trim();

  if (!etiqueta) {
    return;
  }

  const contenido = document.createElement("span");
  contenido.textContent = etiqueta;

  layer.bindTooltip(contenido, {
    permanent: false,
    sticky: true,
    direction: "auto",
    className: "etiqueta-entidad"
  });
}

// Departamento del Huila.
async function cargarDepartamento() {
  try {
    const datos = seleccionarHuila(
      await leerGeoJSON("datos/departamentos.geojson")
    );

    departamentosGeoJSON = L.geoJSON(datos, {
      attribution: fuenteDANE,

      style: {
        color: "#145da0",
        weight: 1.5,
        fillColor: "#8cc8ff",
        fillOpacity: 0.15
      },

      onEachFeature: function (feature, layer) {
        const propiedades = feature.properties || {};

        layer.bindPopup(
          crearPopup("Departamento del Huila", {
            Nombre: propiedades.dpto_cnmbr,
            Código: propiedades.dpto_ccdgo
          })
        );

        layer.on("mouseover", function () {
          info.update(propiedades);

          layer.setStyle({
            color: "#ff7800",
            weight: 2,
            fillOpacity: 0.3
          });
        });

        layer.on("mouseout", function () {
          departamentosGeoJSON.resetStyle(layer);
          info.update();
        });
      }
    });

    registrarCapa(
      departamentosGeoJSON,
      "Huila (GeoJSON)",
      "#145da0",
      false,
      true
    );

    // Obtener la envolvente y encuadrar el departamento.
    const huilaBounds = departamentosGeoJSON.getBounds();

    if (huilaBounds.isValid()) {
      map.fitBounds(huilaBounds, { padding: [20, 20] });
    }

    estado = "Pasa el cursor sobre el Huila.";
    info.update();
  } catch (error) {
    console.error("Error cargando Huila:", error);
    estado = "No se pudo cargar el Huila: " + error.message;
    info.update();
  }
}

// Municipios pertenecientes al Huila.
async function cargarMunicipios() {
  try {
    const datos = seleccionarHuila(
      await leerGeoJSON("datos/municipios.geojson")
    );

    const municipiosGeoJSON = L.geoJSON(datos, {
      attribution: fuenteDANE,
      pane: "municipios",

      style: {
        color: "#319b48",
        weight: 1,
        fill: false
      },

      onEachFeature: function (feature, layer) {
        const propiedades = feature.properties || {};

        layer.bindPopup(
          crearPopup("Municipio del Huila", {
            Nombre: propiedades.mpio_cnmbr,
            Código:
              propiedades.mpio_cdpmp ??
              propiedades.mpio_ccdgo,
            Departamento: propiedades.dpto_cnmbr
          })
        );

        agregarEtiqueta(layer, propiedades.mpio_cnmbr);
      }
    });

    registrarCapa(
      municipiosGeoJSON,
      "Municipios del Huila",
      "#319b48",
      false,
      false
    );
  } catch (error) {
    console.error("Error cargando municipios:", error);
    alert("No se pudieron cargar los municipios: " + error.message);
  }
}

// Capas adicionales disponibles en datos/41_HUILA.
const capasAdicionales = [
  {
    archivo: "Administrativo_P",
    nombre: "Puntos administrativos",
    color: "#7c3aed",
    punto: true
  },
  {
    archivo: "Administrativo_R",
    nombre: "Áreas administrativas",
    color: "#9333ea"
  },
  {
    archivo: "Bosque",
    nombre: "Bosques",
    color: "#15803d"
  },
  {
    archivo: "Construccion_P",
    nombre: "Construcciones",
    color: "#dc2626",
    punto: true
  },
  {
    archivo: "Curva_Nivel",
    nombre: "Curvas de nivel",
    color: "#a16207"
  },
  {
    archivo: "Drenaje_Sencillo",
    nombre: "Drenajes",
    color: "#0284c7"
  },
  {
    archivo: "Isla",
    nombre: "Islas",
    color: "#ca8a04"
  },
  {
    archivo: "Laguna",
    nombre: "Lagunas",
    color: "#2563eb"
  },
  {
    archivo: "Orografia",
    nombre: "Orografía",
    color: "#92400e",
    punto: true
  },
  {
    archivo: "Via",
    nombre: "Vías",
    color: "#c2410c"
  }
];

// Cargar una capa adicional y sus etiquetas.
async function cargarCapaAdicional(configuracion) {
  const ruta =
    "datos/41_HUILA/" + configuracion.archivo + ".geojson";

  const datos = await leerGeoJSON(ruta);

  const capa = L.geoJSON(datos, {
    pane: "tematicas",

    style: {
      color: configuracion.color,
      weight: 1.2,
      opacity: 0.9,
      fillColor: configuracion.color,
      fillOpacity: 0.2
    },

    pointToLayer: function (feature, latlng) {
      return L.circleMarker(latlng, {
        pane: "tematicas",
        radius: 4,
        color: configuracion.color,
        weight: 1,
        fillColor: configuracion.color,
        fillOpacity: 0.8
      });
    },

    onEachFeature: function (feature, layer) {
      const propiedades = feature.properties || {};

      layer.bindPopup(
        crearPopup(configuracion.nombre, propiedades)
      );

      if (configuracion.archivo === "Curva_Nivel") {
        const altura = propiedades.ALTURA_SOB;

        if (
          altura !== null &&
          altura !== undefined &&
          altura !== ""
        ) {
          agregarEtiqueta(layer, "Elevación: " + altura);
        }
      } else {
        // Incluye orografía y drenajes con nombre disponible.
        agregarEtiqueta(layer, propiedades.NOMBRE_GEO);
      }
    }
  });

  registrarCapa(
    capa,
    configuracion.nombre,
    configuracion.color,
    configuracion.punto || false,
    false
  );
}

// Iniciar la carga.
async function iniciarVisor() {
  await cargarDepartamento();
  await cargarMunicipios();

  const archivosFallidos = [];

  for (const configuracion of capasAdicionales) {
    try {
      await cargarCapaAdicional(configuracion);
    } catch (error) {
      console.error(
        "Error cargando " + configuracion.nombre + ":",
        error
      );

      archivosFallidos.push(configuracion.archivo);
    }
  }

  if (archivosFallidos.length > 0) {
    alert(
      "No se pudieron cargar estas capas adicionales:\n" +
      archivosFallidos.join("\n") +
      "\nRevisa sus archivos en datos/41_HUILA."
    );
  }
}

iniciarVisor();
