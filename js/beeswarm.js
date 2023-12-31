class BeeswarmChart {
  /**
   * Class constructor with basic chart configuration
   * @param {Object}
   * @param {Array}
   */
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || 600,
      containerHeight: _config.containerHeight || 420,
      tooltipPadding: 15,
      margin: _config.margin || {
        top: 20,
        right: 30,
        bottom: 20,
        left: 20,
      },
    };
    this.data = _data;
    this.initVis();
  }

  /**
   * Initialize scales/axes and append static chart elements
   */
  initVis() {
    let vis = this;

    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    vis.xScale = d3.scaleLog().domain([100000, 50000000]).range([0, vis.width]);

    // Initialize axes
    vis.xAxis = d3
      .axisBottom(vis.xScale)
      .tickSizeOuter(0)
      .tickFormat(d => d.toLocaleString())
      .tickValues([100000, 500000, 1000000, 5000000, 10000000, 50000000]);

    vis.padding = 1.5;


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
        `translate(${vis.config.margin.left},${vis.config.margin.top})`
      );

    // Append Axis Groups
    vis.xAxisG = vis.chart
      .append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${vis.height - vis.config.margin.bottom})`);


    vis.xAxisTitle = vis.chart.append('text')
      .attr('class', 'axis-label')
      .attr("x", vis.width / 2)
      .attr('y', vis.height + 15)
      .style('text-anchor', 'middle')
      .text('Views');

    vis.updateVis();
  }

  /**
   * Prepare the data and scales before we render it.
   */
  updateVis() {
    let vis = this;

    vis.xValue = d => d.views;

    if (vis.data.length > 1000) {
      vis.radius = 2;
    } else if (vis.data.length > 850) {
      vis.radius = 2.6;
    } else {
      vis.radius = 3;
    }

    vis.data = vis.dodge(vis.data, { radius: vis.radius * 2 + vis.padding, x: d => vis.xScale(d.views) })

    vis.renderVis();
  }

  /**
   * Bind data to visual elements
   */
  renderVis() {
    let vis = this;

    if (vis.data.length == 0) {
      vis.svg
        .select(".no-data-message")
        .remove();
        
      vis.svg
        .append("text")
        .attr("class", "no-data-message")
        .attr("x", vis.config.containerWidth / 2)
        .attr("y", vis.height / 2)
        .attr("text-anchor", "middle")
        .text("No talks that meet your specifications");
    } else {
      // Remove the no data message if it exists 
      vis.svg
        .select(".no-data-message")
        .remove();
    }

      const bees = vis.chart.selectAll('.bee-mark')
        .data(vis.data, d => d)
        .join("circle")
        .attr("cx", d => d.x)
        .attr("cy", d => vis.height - vis.config.margin.bottom - vis.radius - vis.padding - d.y)
        .attr("r", vis.radius)
        .attr('class', 'bee-mark');

      bees
        .on("mouseover", (event, d) => {
          const selectedCircle = d3.select(event.currentTarget);

          selectedCircle.style("fill-opacity", 0.5).style("stroke-opacity", 0.5);

          d3
            .select("#tooltip")
            .style("display", "block")
            .style("left", event.pageX + vis.config.tooltipPadding + "px")
            .style("top", event.pageY - 80 + vis.config.tooltipPadding + "px")
            .html(`
              <div class="tooltip-title">${d.data.headline}</div>
                ${d.data.speaker_1}
                </br>
                ${d.data.views.toLocaleString()} views
                </br>
            `);
        })
        .on("mouseleave", (event, d) => {
          const selectedCircle = d3.select(event.currentTarget);

          selectedCircle.style("fill-opacity", 1).style("stroke-opacity", 1);

          d3.select("#tooltip").style("display", "none");
        })
        .on("click", (event, d) => {
          window.open(d.data.public_url, '_blank').focus();
        });
    
    
    // Update the axes
    vis.xAxisG.call(vis.xAxis);
  }

  dodge(data, { radius = 1, x = d => d } = {}) {
    const radius2 = radius ** 2;
    const circles = data.map((d, i, data) => ({ x: +x(d, i, data), data: d })).sort((a, b) => a.x - b.x);
    const epsilon = 1e-3;
    let head = null, tail = null;

    // Returns true if circle ⟨x,y⟩ intersects with any circle in the queue.
    function intersects(x, y) {
      let a = head;
      while (a) {
        if (radius2 - epsilon > (a.x - x) ** 2 + (a.y - y) ** 2) {
          return true;
        }
        a = a.next;
      }
      return false;
    }

    // Place each circle sequentially.
    for (const b of circles) {

      // Remove circles from the queue that can’t intersect the new circle b.
      while (head && head.x < b.x - radius2) head = head.next;

      // Choose the minimum non-intersecting tangent.
      if (intersects(b.x, b.y = 0)) {
        let a = head;
        b.y = Infinity;
        do {
          let y = a.y + Math.sqrt(radius2 - (a.x - b.x) ** 2);
          if (y < b.y && !intersects(b.x, y)) b.y = y;
          a = a.next;
        } while (a);
      }

      // Add b to the queue.
      b.next = null;
      if (head === null) head = tail = b;
      else tail = tail.next = b;
    }

    return circles;
  }
}

