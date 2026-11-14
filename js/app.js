// Crear el mapa centrado en el Huila
const map = L.map('map', {
    maxBoundsViscosity: 1.0
}).setView([2.9273, -75.2819], 8);

// Capas base
const baseMaps = {
    "OpenStreetMap": L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }
    ),
    "Satellite": L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
            attribution: 'Tiles &copy; Esri',
            maxZoom: 19
        }
    )
};

baseMaps["OpenStreetMap"].addTo(map);

// Control de capas
const controlLayer = L.control.layers(baseMaps, {}, {
    collapsed: false
}).addTo(map);

// Código DANE del Huila
const HUILA_CCDGO = '41';

let departamentosGeoJSON;

// Cargar un archivo GeoJSON y comprobar la respuesta
async function leerGeoJSON(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `No se pudo cargar ${url}. Error HTTP ${response.status}`
        );
    }

    return response.json();
}

// Cargar únicamente el polígono del Huila
leerGeoJSON('datos/departamentos.geojson')
    .then(data => {
        departamentosGeoJSON = L.geoJSON(data, {
            filter: feature =>
                String(feature.properties?.dpto_ccdgo) === HUILA_CCDGO,

            style: {
                color: '#232323',
                weight: 2,
                fillColor: '#e8f881',
                fillOpacity: 0.25
            },

            onEachFeature: onEachFeature
        });

        const huilaBounds = departamentosGeoJSON.getBounds();

        if (!huilaBounds.isValid()) {
            throw new Error(
                'No se encontró Huila con código 41 en departamentos.geojson'
            );
        }

        departamentosGeoJSON.addTo(map);
        controlLayer.addOverlay(departamentosGeoJSON, 'Departamento del Huila');

        // Envolvente rectangular del Huila
        const envolvente = L.rectangle(huilaBounds, {
            color: '#d32f2f',
            weight: 2,
            dashArray: '8, 6',
            fill: false,
            interactive: false
        }).addTo(map);

        controlLayer.addOverlay(envolvente, 'Envolvente del Huila');

        // Limitar la navegación con un pequeño margen
        const limiteHuila = huilaBounds.pad(0.10);

        map.fitBounds(limiteHuila);
        map.setMaxBounds(limiteHuila);
        map.setMinZoom(map.getZoom());
    })
    .catch(error => {
        console.error('Error cargando el Huila:', error);
        alert('No se pudo cargar el límite del Huila. ' + error.message);
    });

// Carpeta de datos del Huila
const huilaDataDir = './datos/41_HUILA/';

// Capas disponibles
const capasHuila = [
    {
        file: 'Administrativo_P.geojson',
        label: 'Topónimos administrativos',
        color: '#c62828',
        radio: 4
    },
    {
        file: 'Construccion_P.geojson',
        label: 'Construcciones',
        color: '#6d4c41',
        radio: 3
    },
    {
        file: 'Via.geojson',
        label: 'Vías',
        estilo: {
            color: '#e65100',
            weight: 1.5
        }
    },
    {
        file: 'Drenaje_Sencillo.geojson',
        label: 'Drenaje sencillo',
        estilo: {
            color: '#1e88e5',
            weight: 1
        }
    },
    {
        file: 'Curva_Nivel.geojson',
        label: 'Curvas de nivel',
        estilo: {
            color: '#8d6e63',
            weight: 0.8
        }
    },
    {
        file: 'Laguna.geojson',
        label: 'Lagunas',
        estilo: {
            color: '#0277bd',
            weight: 1,
            fillColor: '#4fc3f7',
            fillOpacity: 0.5
        }
    },
    {
        file: 'Bosque.geojson',
        label: 'Bosques',
        estilo: {
            color: '#1b5e20',
            weight: 1,
            fillColor: '#66bb6a',
            fillOpacity: 0.4
        }
    }
];

// Mostrar los valores de los datos como texto seguro
function escaparHTML(valor) {
    const elemento = document.createElement('span');
    elemento.textContent = String(valor ?? '');
    return elemento.innerHTML;
}

// Contenido de las ventanas de las capas
function popupHuila(props) {
    const campos = [
        ['NOMBRE_GEO', 'Nombre'],
        ['TIPO_VIA', 'Tipo de vía'],
        ['ESTADO_SUP', 'Estado superficie'],
        ['ESTADO_DRE', 'Estado drenaje'],
        ['ALTURA_SOB', 'Altura (m)'],
        ['TIPO_CURVA', 'Tipo de curva'],
        ['CODIGO_USO', 'Código de uso'],
        ['CODIGO_NOM', 'Código']
    ];

    const filas = campos
        .filter(([campo]) =>
            props[campo] !== undefined &&
            props[campo] !== null &&
            props[campo] !== ''
        )
        .map(([campo, etiqueta]) =>
            `<p style="margin:2px 0">
                <strong>${etiqueta}:</strong>
                ${escaparHTML(props[campo])}
            </p>`
        );

    return filas.length
        ? `<div>${filas.join('')}</div>`
        : '<div>Sin atributos</div>';
}

// Descargar una capa cuando se active
async function cargarCapaHuila(cfg) {
    if (cfg._loaded || cfg._loading) return;

    cfg._loading = true;

    try {
        const data = await leerGeoJSON(huilaDataDir + cfg.file);

        const capa = L.geoJSON(data, {
            style: cfg.estilo,

            pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
                radius: cfg.radio || 4,
                color: cfg.color || '#3388ff',
                fillColor: cfg.color || '#3388ff',
                weight: 1,
                fillOpacity: 0.8
            }),

            onEachFeature: (feature, layer) => {
                if (feature.properties) {
                    layer.bindPopup(popupHuila(feature.properties));
                }
            }
        });

        capa.addTo(cfg._group);
        cfg._loaded = true;
    } catch (error) {
        console.error('Error cargando ' + cfg.file + ':', error);
        alert(
            'No se pudo cargar la capa "' + cfg.label +
            '". Desmárcala y vuelve a marcarla para reintentar.'
        );
    } finally {
        cfg._loading = false;
    }
}

// Registrar las capas en el selector
capasHuila.forEach(cfg => {
    cfg._group = L.layerGroup();
    cfg._loaded = false;
    cfg._loading = false;

    controlLayer.addOverlay(cfg._group, cfg.label);
});

// Cargar los datos al marcar una capa
map.on('overlayadd', function (e) {
    const cfg = capasHuila.find(capa => capa._group === e.layer);

    if (cfg) {
        cargarCapaHuila(cfg);
    }
});

// Ventana e interacción del departamento
function onEachFeature(feature, layer) {
    const props = feature.properties || {};

    layer.bindPopup(`
        <div style="text-align:center">
            <h3>${escaparHTML(props.dpto_cnmbr || 'Huila')}</h3>
            <p>
                <strong>Código:</strong>
                ${escaparHTML(props.dpto_ccdgo || '41')}
            </p>
        </div>
    `);

    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
}

function highlightFeature(e) {
    e.target.setStyle({
        weight: 4,
        color: '#666',
        fillOpacity: 0.4
    });
}

function resetHighlight(e) {
    if (departamentosGeoJSON) {
        departamentosGeoJSON.resetStyle(e.target);
    }
}

function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

// Escala
L.control.scale({
    position: 'bottomleft',
    metric: true,
    imperial: false
}).addTo(map);

// Panel de información
const info = L.control({
    position: 'topleft'
});

info.onAdd = function () {
    const div = L.DomUtil.create('div', 'info');

    div.innerHTML = `
        <h4>Huila - Servicios Geográficos</h4>
        <p>Capas del departamento del Huila</p>
        <p><small>Datos: DANE / IGAC</small></p>
    `;

    L.DomEvent.disableClickPropagation(div);

    return div;
};

info.addTo(map);

// Control de búsqueda
const searchControl = L.control({
    position: 'topright'
});

searchControl.onAdd = function () {
    const div = L.DomUtil.create('div', 'search-control');

    div.style.background = 'white';
    div.style.padding = '8px';
    div.style.borderRadius = '5px';

    div.innerHTML = `
        <input
            type="text"
            id="search-input"
            placeholder="Buscar Huila..."
            aria-label="Buscar departamento"
        >
        <button id="search-button" type="button">Buscar</button>
    `;

    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    return div;
};

searchControl.addTo(map);

// Los controles ya están creados; registrar sus eventos
const searchButton = document.getElementById('search-button');
const searchInput = document.getElementById('search-input');

function buscar() {
    const texto = searchInput.value.trim().toLowerCase();

    if (!texto) return;

    if (!departamentosGeoJSON) {
        alert('El departamento todavía no ha terminado de cargar.');
        return;
    }

    let encontrado = null;

    departamentosGeoJSON.eachLayer(layer => {
        const nombre = String(
            layer.feature.properties?.dpto_cnmbr || 'Huila'
        ).toLowerCase();

        if (!encontrado && nombre.includes(texto)) {
            encontrado = layer;
        }
    });

    if (encontrado) {
        if (!map.hasLayer(departamentosGeoJSON)) {
            departamentosGeoJSON.addTo(map);
        }

        map.fitBounds(encontrado.getBounds());
        encontrado.openPopup();
    } else {
        alert('Este visor solo contiene el departamento del Huila.');
    }
}

searchButton.addEventListener('click', buscar);

searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        buscar();
    }
});

// Marcador de Neiva
const neivaMarker = L.marker([2.9273, -75.2819])
    .addTo(map)
    .bindPopup('<b>Neiva</b><br>Capital del Huila');
