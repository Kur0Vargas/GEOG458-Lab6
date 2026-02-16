mapboxgl.accessToken = 'pk.eyJ1IjoiYXRyYW4wMjMiLCJhIjoiY21reGhuaGJ2MGE5MzNsbmJkZjV0cWVvOCJ9.AXQlCqhl_yS9Uw4N6amrNg';

let map = new mapboxgl.Map({
    container: 'map', 
    style: 'mapbox://styles/mapbox/dark-v10',
    center: [-122.335, 47.608], // starting center (Seattle)
    zoom: 10, // starting zoom
    minZoom: 10,
    maxZoom: 15
});

let collisionChart = null;

const grades = [100, 5000, 10000],
    colors = ['rgb(208,209,230)', 'rgb(103,169,207)', 'rgb(1,108,89)'],
    radii = [15, 25, 35];

const legend = document.getElementById('legend');

let labels = ['<strong>Incidents</strong>'], vbreak;

for (var i = 0; i < grades.length; i++) {
    vbreak = grades[i];
    dot_radii = 2 * radii[i];
    labels.push(
        '<p class="break"><i class="dot" style="background:' + colors[i] + '; width: ' + dot_radii +
        'px; height: ' + dot_radii + 'px; "></i> <span class="dot-label" style="top: ' + dot_radii / 2 + 'px;">' + vbreak + '+' +
        '</span></p>');
}

legend.innerHTML = labels.join('');

async function geojsonFetch() {
    let response = await fetch('assets/SDOT_Collisions_Vehicles_2014_2015.geojson');
    let collisions = await response.json();

    // excess entries in the geojson/data
    const cleanFeatures = [];
    const seen = new Set();
    collisions.features.forEach(f => {
        let id = f.properties.COLDETKEY || f.properties.REPORTNO;
        if (!seen.has(id)) {
            seen.add(id);
            cleanFeatures.push(f);
        }
    });
    collisions.features = cleanFeatures;

    map.on('load', () => {
        map.addSource('collisions', {
            type: 'geojson',
            data: collisions,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 180 
        });

        map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'collisions',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': ['step', ['get', 'point_count'], colors[0], grades[1], colors[1], grades[2], colors[2]],
                'circle-radius': ['step', ['get', 'point_count'], radii[0], grades[1], radii[1], grades[2], radii[2]],
                'circle-opacity': 0.6,
                'circle-stroke-color': 'white',
                'circle-stroke-width': 1
            }
        });

        map.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'collisions',
            filter: ['has', 'point_count'],
            layout: {
                'text-field': '{point_count_abbreviated}',
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 12
            }
        });

        map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'collisions',
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-color': colors[0],
                'circle-radius': 4,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        });

        collisionChart = c3.generate({
            bindto: "#chart", //call name
            size: { height: 350, width: 440 },
            data: {
                columns: [['Clusters', 0, 0, 0]],
                type: 'bar',
                colors: { 'Clusters': (d) => colors[d.x] }
            },
            axis: {
                x: {
                    type: 'category',
                    categories: ['100+', '5000+', '10000+']
                },
                y: { 
                    tick: { 
                        values: [1, 2, 3, 4, 5, 10, 15, 20, 30, 40] 
                    },
                    label: 'Cluster Count'
                }
            },
            legend: { show: false }
        });

        updateDashboard();
    });

    map.on('idle', updateDashboard);

    function updateDashboard() {
        const features = map.querySourceFeatures('collisions');
        let total = 0;
        let tierCounts = [0, 0, 0];
        const uniqueIds = new Set(); 

        features.forEach(f => {
            let id = f.id || JSON.stringify(f.geometry.coordinates);
            if (uniqueIds.has(id)) return;
            uniqueIds.add(id);

            if (f.properties.cluster) {
                let pCount = f.properties.point_count;
                total += pCount;
                if (pCount >= 10000) tierCounts[2]++;
                else if (pCount >= 5000) tierCounts[1]++;
                else if (pCount >= 100) tierCounts[0]++;
            } else {
                total += 1;
            }
        });

        document.getElementById("collision-count").innerHTML = total.toLocaleString();
        
        collisionChart.load({
            columns: [['Clusters', ...tierCounts]]
        });
    }
}

geojsonFetch();

// reset settings
const reset = document.getElementById('reset');
reset.addEventListener('click', event => {
    event.preventDefault();
    map.flyTo({
        zoom: 10,
        center: [-122.335, 47.608]
    });
});