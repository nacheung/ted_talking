class ChordDiagram {

    /**
     * Class constructor with initial configuration
     * @param {Object}
     */
    constructor(_config, data, tagMatrix, selectedTagIndices, tagColours, dispatcher) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: 600,
            containerHeight: 600,
            tooltipPadding: 10,
            margin: {
                top: 40,
                right: 15,
                bottom: 20,
                left: 20
            }
        }
        this.data = data;
        this.tagMatrix = tagMatrix;
        this.selectedTagIndices = selectedTagIndices;
        this.tagColours = tagColours;
        this.dispatcher = dispatcher;
        this.initVis();
    }

    initVis() {
        let vis = this;

        // Calculate inner chart size. Margin specifies the space around the actual chart.
        vis.config.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.config.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Define size of SVG drawing area
        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);

        // Append group element that will contain our actual chart
        // and position it according to the given margin config
        vis.chartArea = vis.svg.append('g')
            .attr('transform', "translate(300,300)");

    }

    updateVis() {
        let vis = this;

        vis.renderVis();
    }

    renderVis() {
        let vis = this;

        // Define colors
        const colors = Object.values(this.tagColours);

        // Create donut chart (https://d3-graph-gallery.com/graph/chord_colors.html)
        const chord = d3.chord()
            .padAngle(0.05)
            .sortSubgroups(d3.descending)
            (this.tagMatrix);

        // Add groups
        let group = vis.chartArea
            .selectAll(".arc-group")
            .data(() => {
                return [chord];
            })
            .join("g")
            .attr("class", "arc-group")
            .selectAll(".group")
            .data(d => {
                return d.groups;
            });

        let groupEnter = group.enter()
            .append("g")
            .attr("class", "group");

        groupEnter.merge(group);

        group.exit().remove();

        // Add arcs
        let arcs = group.merge(groupEnter).selectAll(".arc")
            .data(d => {
                return [d];
            })
            .join("path")
            .attr("class", "arc")
            .style("fill", (d) => {
                return colors[d.index];
            })
            .style("stroke", "black")
            .attr("d", d3.arc()
                .innerRadius(200)
                .outerRadius(210)
                .startAngle((d) => {
                    return d.startAngle;
                })
                .endAngle((d) => d.endAngle));

        // add labels
        let labels = group.merge(groupEnter).selectAll(".arc-label")
            .data(d => [d])
            .join("text")
            .each(d => {
                return d.angle = ((d.startAngle + d.endAngle) / 2);
            })
            .attr("dy", ".25em")
            .attr("class", "arc-label")
            .attr("text-anchor", (d) => { return d.angle > Math.PI ? "end" : null; })
            .attr("transform", (d, i) => {
                return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")"
                    + "translate(" + (200 + 15) + ")" //how close the labels are to the outer arc
                    + (d.angle > Math.PI ? "rotate(180)" : "")
            })
            .text((d) => top50Tags[d.index]);

        let arcsAndLabels = [arcs, labels];

        // Add click and hover event listeners to arc and labels
        arcsAndLabels.forEach((e) => {
            e.on("mouseover", (event, d) => {
                let isHovered = p => (p.source.index == d.index) || (p.target.index == d.index);
                chords.classed("fade", (chord) => !isHovered(chord));
                chords.classed("hover", (chord) => isHovered(chord));
                chords.style("stroke", (chord, index, element) => {
                    const currentColor = element[index].style.stroke;
                    return isHovered(chord) ? colors[d.index] : currentColor;
                });
                chords.style("fill", (chord, index, element) => {
                    const currentColor = element[index].style.fill;
                    return isHovered(chord) ? colors[d.index] : currentColor;
                });
                labels.classed("hover", (label) => label.index == d.index);
                arcs.classed("hover", (arc) => arc.index == d.index);
            })
                .on("mouseleave", () => {
                    arcs.classed("hover", false);
                    chords.classed("fade", false);
                    chords.classed("hover", false);
                    labels.classed("hover", false);
                    let selectedColors = selectedTags.map((tag) => this.tagColours[tag]);
                    chords.style("stroke", (chord) => {
                        return selectedColors.includes(colors[chord.target.index]) ? (colors[chord.target.index]) : colors[chord.source.index];
                    });
                    chords.style("fill", (chord) => {
                        return selectedColors.includes(colors[chord.target.index]) ? (colors[chord.target.index]) : colors[chord.source.index];

                    });
                })
                .on("click", (event, d) => {
                    // if the tag is already selected, unselect it. 
                    if (this.selectedTagIndices.length == MAX_SELECTED_TAGS && !this.selectedTagIndices.includes(d.index))
                        this.selectedTagIndices.pop();
                    // If the tag is already selected, remove it from the selectedTagIndices array.
                    // Else, add it to the array. 
                    this.selectedTagIndices.includes(d.index) ?
                        this.selectedTagIndices = this.selectedTagIndices.filter((index) => index != d.index)
                        :
                        this.selectedTagIndices.push(d.index);
                    // Add classNames to the chords and labelsaccordingly
                    const isSelected = (p) =>
                        (this.selectedTagIndices.includes(p.source.index) || this.selectedTagIndices.includes(p.target.index));
                    chords.classed("selected", (p) => isSelected(p));
                    chords.classed("notSelected", (p) => !isSelected(p) && this.selectedTagIndices.length > 0);
                    labels.classed("selected", (label) => this.selectedTagIndices.includes(label.index));
                    // Remove hover and fade classNames so that hover state is not shown after click
                    chords.classed("hover", false);
                    if (this.selectedTagIndices.length == 0)
                        chords.classed("fade", false); // if no tags are selected, show all chords
                    vis.dispatcher.call('updateSelectedTags', event, this.selectedTagIndices);
                });
        });

        // Add the links between groups
        let chords = vis.chartArea
            .selectAll(".path-group")
            .data(() => {
                return [chord];
            })
            .join("g")
            .attr("class", "path-group")
            .selectAll(".chord")
            .data((d) => d)
            .join("path")
            .attr("class", "chord")
            .attr("d", d3.ribbon()
                .radius(200)
            );

        // For the randomly chosen tags on initial render, set the chords as selected or nonselected accordingly.
        const isSelected = (p) =>
            (this.selectedTagIndices.includes(p.source.index) || this.selectedTagIndices.includes(p.target.index));
        chords.classed("selected", (p) => isSelected(p));
        chords.classed("notSelected", (p) => !isSelected(p) && this.selectedTagIndices.length > 0);
        labels.classed("selected", (label) => this.selectedTagIndices.includes(label.index));
        // And reset their colors so that their chords match their arc color.
        chords.style("stroke", (chord) => {
            if (this.selectedTagIndices.includes(chord.target.index)) {
                return colors[chord.target.index];
            } else {
                return colors[chord.source.index];
            }
        });
        chords.style("fill", (chord) => {
            if (this.selectedTagIndices.includes(chord.target.index)) {
                return colors[chord.target.index];
            } else {
                return colors[chord.source.index];
            }
        });

    }

}
