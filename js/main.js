
let data, tagData, chordDiagram, linechart, beeswarmChart, circlePack;
let top50Tags = [], selectedTags = [], selectedTagIndices = [];
let selectedOccupation = "", selectedOccupationLevel = 0, selectedOccupationParent = "";
let tagColours = {};
let minDuration = 2, maxDuration = 45;

// Define colors
const colors = [ 
    "#2f4f4f", "#556b2f", "#8b4513", "#2e8b57", "#7f0000",
    "#006400", "#708090", "#808000", "#483d8b", "#bc8f8f",
    "#008b8b", "#4682b4", "#d2691e", "#9acd32", "#cd5c5c",
    "#4b0082", "#32cd32", "#daa520", "#8fbc8f", "#8b008b",
    "#b03060", "#d2b48c", "#48d1cc", "#9932cc", "#ff0000",
    "#ff8c00", "#ffd700", "#0000cd", "#00ff00", "#00fa9a",
    "#dc143c", "#00bfff", "#0000ff", "#a020f0", "#adff2f",
    "#ff6347", "#da70d6", "#d8bfd8", "#ff00ff", "#f0e68c",
    "#ffff54", "#6495ed", "#dda0dd", "#90ee90", "#add8e6",
    "#ff1493", "#7b68ee", "#ffa07a", "#7fffd4", "#ff69b4",
];

const MAX_SELECTED_TAGS = 3;
const dispatcher = d3.dispatch('updateSelectedTags', 'updateSelectedOccupations');

// Initialize helper function to convert date strings to date objects
const parseTime = d3.timeParse("%m/%d/%y");

/**
 * Load data from CSV file asynchronously and render charts
 */
d3.csv('data/TED_final.csv').then(_data => {

    tagsObj = {};
    _data.forEach((d) => {
        d.published = parseTime(d.published); // Convert string to date object
        d.year = d.published.getFullYear();

        Object.keys(d).forEach(attr => {
            if (attr == 'pcgdp') {
                d[attr] = (d[attr] == 'NA') ? null : +d[attr];
            } else if (attr == 'TALK_ID' || attr == 'views') {
                d[attr] = +d[attr];
            } else if (attr == 'duration') {
                d[attr] = d[attr].split(':')[1];
                d[attr] = +d[attr];
            } else if (attr == 'published') {
                d[attr] = Date.parse(d[attr]);
            } else if (attr == 'tags') {
                d[attr] = d[attr].split(',');
                d[attr].forEach(tag => {
                    tagsObj[tag] = (tagsObj[tag] || 0) + 1
                })
            }
        });
    });

    data = _data;

    let tagsArray = [];
    for (let key in tagsObj) {
        tagsArray.push({
            tag: key,
            value: tagsObj[key]
        });
    }

    // Sort tags in order of how many talks they are associated with (from most to least)
    const sortedTagsArray = tagsArray.sort((a, b) => {
        return (a.value < b.value) ? 1 : ((b.value < a.value) ? -1 : 0)
    });

    // Add the top 50 to the top50Tags array
    for (let i = 0; i < 50; i++) {
        top50Tags.push(sortedTagsArray[i].tag);
    }
    setTagColours();

    // Randomly select 3 tags to show links on initial render (so that chord diagram isn't overwhelming)
    let i = 0;
    while (i < 3) {
        const randIndex = Math.floor(Math.random() * 50);
        if (!selectedTagIndices.includes(randIndex)) {
            selectedTagIndices.push(randIndex);
            selectedTags.push(top50Tags[randIndex]);
            i++;
        }
    }
    document.getElementById("tag-1").innerHTML = selectedTags[0];
    document.getElementById("tag-2").innerHTML = selectedTags[1];
    document.getElementById("tag-3").innerHTML = selectedTags[2];

    // Create array of hashmaps (one hashmap for each tag, each hashmap consisting)
    // of other tags (keys) and the number of links (values) for chord diagram
    tagData = {};

    data.forEach(d => {
        let tags = d['tags'];
        for (let tag of tags) {
            if (top50Tags.includes(tag)) {
                for (let tag2 of tags) {
                    if (top50Tags.includes(tag2)) {
                        if (!(tag in tagData)) tagData[tag] = {};
                        if (tag != tag2) tagData[tag][tag2] = (tagData[tag][tag2] || 0) + 1;
                    }
                }
            }
        };
    });

    // Create tags matrix for chord diagram
    let tagMatrix = [];

    for (let i = 0; i < 50; i++) {
        let matrixRow = [];
        let rowTag = top50Tags[i];
        for (let j = 0; j < 50; j++) {
            let colTag = top50Tags[j];
            if (i != j && Object.keys(tagData[rowTag]).includes(colTag))
                matrixRow.push(tagData[rowTag][colTag]);
            else
                matrixRow.push(0);
        }
        tagMatrix.push(matrixRow);
    }

    // create charts
    const filteredData = filterDataDurationTags();

    chordDiagram = new ChordDiagram({
        parentElement: '#chord-diagram',
    }, data, tagMatrix, selectedTagIndices, tagColours, dispatcher);
    chordDiagram.updateVis();

    beeswarmChart = new BeeswarmChart({
        parentElement: '#beeswarm-chart',
    }, filteredData);

    linechart = new LineChart({
            parentElement: "#linechart",
        }, filteredData, tagColours, selectedTags);
    
    circlePack = new CirclePack({
        parentElement: "#circle-pack",
    }, filteredData, dispatcher);

}).catch((error) => console.error(error));

dispatcher.on('updateSelectedTags', selectedIndices => {
    selectedTags = [];
    selectedIndices.forEach((i) => selectedTags.push(top50Tags[i]));
    if (selectedTags.length > 0) {
        document.getElementById("tag-1").innerHTML = selectedTags[0];
        if (selectedTags.length > 1) {
            document.getElementById("tag-2").innerHTML = selectedTags[1];
            if (selectedTags.length > 2)
                document.getElementById("tag-3").innerHTML = selectedTags[2];
            else
                document.getElementById("tag-3").innerHTML = "";
        } else {
            document.getElementById("tag-2").innerHTML = "";
        }
    } else {
        document.getElementById("tag-1").innerHTML = "";
    }
    selectedOccupationLevel = 3;

    let filteredData = filterDataDurationTags();
    updateCirclePackChart(filteredData);
    
    filteredData = filterDataOccupation(filteredData);
    updateBeeswarmChart(filteredData);
    updateLineChart(filteredData);
})


dispatcher.on('updateSelectedOccupations', occupation_data => {
    selectedOccupationLevel = occupation_data.depth;
    selectedOccupation = occupation_data.data.name;
    selectedOccupationParent = occupation_data.parent 
    let filteredData = filterDataDurationTags();    
    filteredData = filterDataOccupation(filteredData);
    updateBeeswarmChart(filteredData);
    updateLineChart(filteredData);
    updateChordDiagram(filterDataOccupation(data));
})

function setTagColours() {
    for (let i = 0; i < top50Tags.length; i++) {
        tagColours[top50Tags[i]] = colors[i];
    }
}

function filterDataDurationTags() {
    let filteredData = data.filter(d => d.duration >= fromSlider.value && d.duration <= toSlider.value);
    
    if (selectedTags.length != 0) {
        filteredData = filteredData.filter(d => d.tags.some(r => selectedTags.includes(r)));
    }
    return filteredData;
}

function filterDataOccupation(data) {
    let filteredData = data;

    if (selectedOccupationLevel === 1) {
        filteredData = filteredData.filter(d => d.occupation_broader === selectedOccupation);
    }

    if (selectedOccupationLevel === 2) {
        filteredData = filteredData.filter(d => (d.occupation_categorized === selectedOccupation && d.occupation_broader === selectedOccupationParent.data.name));
    }

    if (selectedOccupationLevel === 3) {
        filteredData = filteredData.filter(d => d.speaker1_occupation === selectedOccupation && d.occupation_broader === selectedOccupationParent.parent.data.name && d.occupation_categorized === selectedOccupationParent.data.name)
    }

    return filteredData;
}

function updateBeeswarmChart(filteredData) {
    beeswarmChart.data = filteredData;
    beeswarmChart.updateVis();
}

function updateCirclePackChart(filteredData) {
    circlePack.data = filteredData;
    circlePack.updateVis(); 
}

function updateLineChart(filteredData) {
    linechart.selectedTags = selectedTags;
    linechart.data = filteredData;
    linechart.updateVis(); 
}

function updateChordDiagram(filteredData) {
    chordDiagram.data = filteredData;

        // Create array of hashmaps (one hashmap for each tag, each hashmap consisting)
        // of other tags (keys) and the number of links (values) for chord diagram
        tagData = {};

        filteredData.forEach(d => {
            let tags = d['tags'];
            for (let tag of tags) {
                if (top50Tags.includes(tag)) {
                    for (let tag2 of tags) {
                        if (top50Tags.includes(tag2)) {
                            if (!(tag in tagData)) tagData[tag] = {};
                            if (tag != tag2) tagData[tag][tag2] = (tagData[tag][tag2] || 0) + 1;
                        }
                    }
                }
            };
        });
        
        // Create tags matrix for chord diagram
        let tagMatrix = [];

        for (let i = 0; i < 50; i++) {
            let matrixRow = [];
            let rowTag = top50Tags[i];
            for (let j = 0; j < 50; j++) {
                let colTag = top50Tags[j];
                if (i != j && Object.keys(tagData).includes(rowTag) && Object.keys(tagData[rowTag]).includes(colTag)){
                    matrixRow.push(tagData[rowTag][colTag]);
                }
                else
                    matrixRow.push(0);
            }
            tagMatrix.push(matrixRow);
        }
    chordDiagram.tagMatrix = tagMatrix;
    chordDiagram.updateVis();
}

function controlFromInput(fromSlider, fromInput, toInput, controlSlider) {
    const [from, to] = getParsed(fromInput, toInput);
    fillSlider(fromInput, toInput, '#C6C6C6', '#25daa5', controlSlider);
    if (from > to) {
        fromSlider.value = to;
        fromInput.value = to;
    } else {
        fromSlider.value = from;
    }
    let filteredData = filterDataDurationTags();
    updateCirclePackChart(filteredData);
    
    filteredData = filterDataOccupation(filteredData);
    updateBeeswarmChart(filteredData);
    updateLineChart(filteredData);
}

function controlToInput(toSlider, fromInput, toInput, controlSlider) {
    const [from, to] = getParsed(fromInput, toInput);
    fillSlider(fromInput, toInput, '#C6C6C6', '#25daa5', controlSlider);
    setToggleAccessible(toInput);
    if (from <= to) {
        toSlider.value = to;
        toInput.value = to;
    } else {
        toInput.value = from;
    }
    let filteredData = filterDataDurationTags();
    updateCirclePackChart(filteredData);
    
    filteredData = filterDataOccupation(filteredData);
    updateBeeswarmChart(filteredData);
    updateLineChart(filteredData);
}

function controlFromSlider(fromSlider, toSlider, fromInput) {
    const [from, to] = getParsed(fromSlider, toSlider);
    fillSlider(fromSlider, toSlider, '#C6C6C6', '#25daa5', toSlider);
    if (from > to) {
        fromSlider.value = to;
        fromInput.value = to;
    } else {
        fromInput.value = from;
    }
    let filteredData = filterDataDurationTags();
    updateCirclePackChart(filteredData);
    
    filteredData = filterDataOccupation(filteredData);
    updateBeeswarmChart(filteredData);
    updateLineChart(filteredData);
}

function controlToSlider(fromSlider, toSlider, toInput) {
    const [from, to] = getParsed(fromSlider, toSlider);
    fillSlider(fromSlider, toSlider, '#C6C6C6', '#25daa5', toSlider);
    setToggleAccessible(toSlider);
    if (from <= to) {
        toSlider.value = to;
        toInput.value = to;
    } else {
        toInput.value = from;
        toSlider.value = from;
    }
    let filteredData = filterDataDurationTags();
    updateCirclePackChart(filteredData);
    
    filteredData = filterDataOccupation(filteredData);
    updateBeeswarmChart(filteredData);
    updateLineChart(filteredData);
}

function getParsed(currentFrom, currentTo) {
    const from = parseInt(currentFrom.value, 10);
    const to = parseInt(currentTo.value, 10);
    return [from, to];
}

function fillSlider(from, to, sliderColor, rangeColor, controlSlider) {
    const rangeDistance = to.max - to.min;
    const fromPosition = from.value - to.min;
    const toPosition = to.value - to.min;
    controlSlider.style.background = `linear-gradient(
      to right,
      ${sliderColor} 0%,
      ${sliderColor} ${(fromPosition) / (rangeDistance) * 100}%,
      ${rangeColor} ${((fromPosition) / (rangeDistance)) * 100}%,
      ${rangeColor} ${(toPosition) / (rangeDistance) * 100}%, 
      ${sliderColor} ${(toPosition) / (rangeDistance) * 100}%, 
      ${sliderColor} 100%)`;
}

function setToggleAccessible(currentTarget) {
    const toSlider = document.querySelector('#toSlider');
    if (Number(currentTarget.value) <= 0) {
        toSlider.style.zIndex = 2;
    } else {
        toSlider.style.zIndex = 0;
    }
}

const fromSlider = document.querySelector('#fromSlider');
const toSlider = document.querySelector('#toSlider');
const fromInput = document.querySelector('#fromInput');
const toInput = document.querySelector('#toInput');
fillSlider(fromSlider, toSlider, '#C6C6C6', '#25daa5', toSlider);
setToggleAccessible(toSlider);

fromSlider.oninput = () => controlFromSlider(fromSlider, toSlider, fromInput);
toSlider.oninput = () => controlToSlider(fromSlider, toSlider, toInput);
fromInput.oninput = () => controlFromInput(fromSlider, fromInput, toInput, toSlider);
toInput.oninput = () => controlToInput(toSlider, fromInput, toInput, toSlider);
