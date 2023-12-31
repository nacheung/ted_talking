class LineChart {
  /**
   * Class constructor with basic chart configuration
   * @param {Object}
   * @param {Array}
   */
  constructor(_config, _data, tagColours, selectedTags) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || 600,
      containerHeight: _config.containerHeight || 400,
      tooltipPadding: 15,
      margin: _config.margin || {
        top: 40,
        right: 30,
        bottom: 30,
        left: 50,
      },
    };
    this.tagColours = tagColours;
    this.selectedTags = selectedTags;
    this.data = _data;
    this.initVis();
  }

  /**
   * Initialize scales/axes and append static chart elements
   */
  initVis() {
    let vis = this;

    vis.width =
      vis.config.containerWidth -
      vis.config.margin.left -
      vis.config.margin.right;
    vis.height =
      vis.config.containerHeight -
      vis.config.margin.top -
      vis.config.margin.bottom;

    vis.xAxisValues = [
      2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
    ];

    vis.xScale = d3
      .scaleLinear()
      .domain([d3.min(vis.xAxisValues), d3.max(vis.xAxisValues)])
      .range([0, vis.width]);

    vis.yScale = d3.scaleLinear().range([vis.height, 0]);

    // Initialize axes
    vis.xAxis = d3
      .axisBottom(vis.xScale)
      .tickValues(vis.xAxisValues)
      .tickFormat(d3.format("d"))
      .tickSizeOuter(0)
      .tickPadding(4);

    vis.yAxis = d3
      .axisLeft(vis.yScale)
      .tickSizeOuter(0)
      .tickPadding(3)
      .tickFormat(d3.format(".0f"));

    // Define size of SVG drawing area
    vis.svg = d3
      .select(vis.config.parentElement)
      .append("svg")
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight);

    // Append group element that will contain our actual chart (see margin convention)
    vis.chart = vis.svg
      .append("g")
      .attr(
        "transform",
        `translate(${vis.config.margin.left},${vis.config.margin.top - 10})`
      );

    // Append Axis Groups
    vis.xAxisG = vis.chart
      .append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${vis.height})`);

    vis.yAxisG = vis.chart.append("g").attr("class", "axis y-axis");

    // Append marks
    vis.marks = vis.chart.append("g");

    vis.allTalksMark = vis.svg
      .append("circle")
      .attr("cx", 150)
      .attr("cy", 10)
      .attr("r", 5);

    vis.allTalksText = vis.svg
      .append("text")
      .attr("dx", 160)
      .attr("dy", 15)
      .text("All talks");
    
    vis.svg
      .append("text")
      .attr("class", "axis-label")
      .attr("text-anchor", "middle")
      .attr("x", vis.config.containerWidth / 2)
      .attr("y", vis.config.containerHeight)
      .text("Years");
    
    vis.svg
      .append("text")
      .attr("class", "axis-label")
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)")
      .attr("x", -vis.config.containerHeight / 2)
      .attr("y", 16)
      .text("Number of Talks");

    vis.updateVis();
  }

  /**
   * Prepare the data and scales before we render it.
   */
  updateVis() {
    let vis = this;

    // Aggregate data by year
    const dataByYear = d3.rollup(
      vis.data,
      (v) => v.length,
      (d) => d.year
    );

    vis.aggregatedData = Array.from(dataByYear, ([year, count]) => ({
      year,
      tags: "All",
      count,
    }));

    // sort aggregated data by year
    vis.aggregatedData.sort((a, b) => d3.ascending(a.year, b.year));

    if (vis.selectedTags.length > 0) {
      // Aggregate data by year and selected tags
      let dataByYearAndTags = new Map();
      vis.selectedTags.forEach((selectedTag) => {
        const filteredData = d3.filter(vis.data, (d) =>
          d.tags.includes(selectedTag)
        );
        dataByYearAndTags.set(
          selectedTag,
          d3.rollup(
            filteredData,
            (v) => v.length,
            (d) => d.year
          )
        );
      });

      // Convert the nested map structure to a flat array of objects, that shows the year, tags and count
      vis.aggregatedData = Array.from(dataByYearAndTags, ([tags, map]) => {
        const flatObjects = Array.from(map, ([year, count]) => ({
          year: +year,
          tags,
          count,
        }));
        return flatObjects;
      })
        .flat()
        .sort((a, b) => d3.ascending(a.year, b.year));
    }

    // Group data by tags
    vis.groupedByTags = Array.from(
      d3.group(vis.aggregatedData, (d) => d.tags),
      ([tags, data]) => ({ tags: [tags], data })
    );

    // Add points for tags with 0 talks in a year
    const tempYearData = [];
    vis.groupedByTags.forEach((entry) => {
      for (let i = 0; i < vis.xAxisValues.length; i++) {
        tempYearData[i] = vis.xAxisValues[i];
      }

      if (entry.data.length != 11) {
        entry.data.forEach((data) => {
          if (tempYearData.includes(data.year)) {
            const index = tempYearData.indexOf(data.year);
            tempYearData.splice(index, 1);
          }
        });
        for (let i = 0; i < tempYearData.length; i++) {
          entry.data.push({
            year: tempYearData[i],
            tags: entry.tags,
            count: 0,
          });
        }
        entry.data.sort((a, b) => d3.ascending(a.year, b.year));
      }
    });

    vis.xValue = (d) => +d.year;
    vis.yValue = (d) => d.count;

    vis.line = d3
      .line()
      .x((d) => vis.xScale(vis.xValue(d)))
      .y((d) => vis.yScale(vis.yValue(d)));

    // Handles no data 
    if (vis.aggregatedData.length === 0) {
      vis.svg
        .select(".no-data-message")
        .remove();
      
      vis.svg
        .append("text")
        .attr("class", "no-data-message")
        .attr("x", vis.config.containerWidth / 2)
        .attr("y", 420 / 2)
        .attr("text-anchor", "middle")
        .text("No talks that meet your specifications");

      // Hide other chart elements
      vis.allTalksMark
        .style("display", "none");
      vis.allTalksText
        .style("display", "none");
      vis.marks
        .selectAll(".marksGroups")
        .style("display", "none");

      // Set yScale domain for if there is no data
      vis.yScale.domain([0, 180]); 
    } else {

      // Remove the no data message if it exists
      vis.allTalksMark
        .style("display", "block");
      vis.allTalksText
        .style("display", "block");
      vis.marks
        .selectAll(".marksGroups")
        .style("display", "block");
      vis.svg
        .select(".no-data-message")
        .remove();

      // Set yScale domain if there is data
      const max = d3.max(vis.aggregatedData, (d) => d.count);
      vis.yScale.domain([0, max + 15]);
    }

    vis.renderVis();
  }

  /**
   * Bind data to visual elements
   */
  renderVis() {
    let vis = this;

    if (vis.selectedTags.length === 0) {
      vis.allTalksMark.style("display", "block");
      vis.allTalksText.style("display", "block");
    } else {
      vis.allTalksMark.style("display", "none");
      vis.allTalksText.style("display", "none");
    }

    vis.svg
      .selectAll(".legend-mark")
      .data(vis.selectedTags, (d) => d)
      .join("circle")
      .attr("class", "legend-mark")
      .attr("cx", (d, i) => i * 170 + 110)
      .attr("cy", 10)
      .attr("r", 5)
      .style("stroke", (d) => tagColours[d])
      .style("fill", (d) => tagColours[d]);

    vis.svg
      .selectAll(".main-text")
      .data(vis.selectedTags, (d) => d)
      .join("text")
      .attr("class", "main-text")
      .attr("dx", (d, i) => i * 170 + 120)
      .attr("dy", 15)
      .text((d) => d);

    // Add <g> for each entry
    vis.marksGroups = vis.marks
      .selectAll(".marksGroups")
      .data(vis.groupedByTags, (d) => d.tags)
      .join("g")
      .attr("class", (d) => `marksGroups ${d.tags}`);

    // Generate a line for each entry
    vis.marksGroups
      .selectAll(".chart-line")
      .data((d) => [d])
      .join("path")
      .attr("class", "chart-line")
      .attr("d", (d) => vis.line(d.data))
      .style("stroke", (d) => {
        return tagColours[d.data[0].tags];
      });

    // Add circle marks for each entry
    const circleMarks = vis.marksGroups
      .selectAll(".circle-mark")
      .data((d) => d.data)
      .join("circle")
      .attr("class", "circle-mark")
      .attr("cx", (d) => vis.xScale(vis.xValue(d)))
      .attr("cy", (d) => vis.yScale(vis.yValue(d)))
      .attr("r", 5)
      .style("stroke", (d) => {
        return tagColours[d.tags];
      })
      .style("fill", (d) => {
        return tagColours[d.tags];
      });

    // Mouse Events
    circleMarks
      .on("mouseover", (event, d) => {
        const selectedCircle = d3.select(event.currentTarget);

        // Make the circle around circle
        vis.chart
          .append("circle")
          .attr("class", "emphasis-circle")
          .attr("r", 7)
          .attr("cx", selectedCircle.attr("cx"))
          .attr("cy", selectedCircle.attr("cy"))
          .attr("stroke", "#888")
          .attr("stroke-width", 1)
          .attr("fill", "none");

        selectedCircle.style("fill-opacity", 0.5).style("stroke-opacity", 0.5);

        d3
          .select("#tooltip")
          .style("display", "block")
          .style("left", event.pageX + vis.config.tooltipPadding + "px")
          .style("top", event.pageY + vis.config.tooltipPadding + "px").html(`
        <div class="tooltip">${d.count} Ted Talks in ${d.year} with the theme: ${d.tags} </div>
      `);
      })
      .on("mouseleave", (event, d) => {
        const selectedCircle = d3.select(event.currentTarget);
        vis.chart.selectAll(".emphasis-circle").remove();

        selectedCircle.style("fill-opacity", 1).style("stroke-opacity", 1);

        d3.select("#tooltip").style("display", "none");
      });

    // Update the axes
    vis.xAxisG.call(vis.xAxis);
    vis.yAxisG.call(vis.yAxis);
  }
}
