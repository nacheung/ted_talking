class CirclePack {
  /**
   * Class constructor with basic chart configuration
   * @param {Object}
   * @param {Array}
   */
  constructor(_config, _data, _dispatcher) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: 600,
      containerHeight: 600,
      tooltipPadding: 15,
      margin: _config.margin || {
        top: 25,
        right: 30,
        bottom: 25,
        left: 30,
      }
    };
    this.data = _data;
    this.dispatcher = _dispatcher;
    this.initVis();
  };

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

    vis.color = d3.scaleLinear()
      .domain([0, 4])
      .range(["#ffffff", "#800080"])
      .interpolate(d3.interpolateHcl);
    // Define size of SVG drawing area
    vis.svg = d3
      .select(vis.config.parentElement)
      .append("svg")
      .attr("width", vis.config.containerWidth)
      .attr("height", vis.config.containerHeight)
      .attr("viewBox", `-${vis.config.containerHeight / 2} -${vis.config.containerHeight / 2} ${vis.config.containerWidth} ${vis.config.containerHeight}`);


    // Append group element that will contain our actual chart (see margin convention)
    vis.chart = vis.svg
      .append("g")
      .attr(
        "transform",
        `translate(${vis.config.margin.left/2},${vis.config.margin.top/2})`
      )
    vis.updateVis();
  }

  /**
   * Prepare the data and scales before we render it.
   */
  updateVis() {
    let vis = this;

    // Aggregate data by occupation broader -> occupation categorized -> speaker occupation
    let nestedData = d3.group(
      vis.data,
      d => d.occupation_broader,
      d => d.occupation_categorized,
      d => d.speaker1_occupation
    );

    const hierarchicalData = new Map();

    hierarchicalData.set('all categories', nestedData)

    // convert the map to proper structure for creating a hierarchical object
    function mapToNestedObject(map) {
      const result = [];

      function convertMapToObject(inputMap) {
        const objectArray = [];

        inputMap.forEach((value, key) => {
          const node = {
            name: key,
            children: [],
            value: 1,
            talkInfo: [],
          };

          if (value instanceof Map) {
            node.value = value.size;
            node.children = convertMapToObject(value);
          } else if (value instanceof Array) {
            if(value.length === 1) {
              node.talkInfo = value;
            } else {
              node.value = value.length;
              node.children = childrenFromArray(value);
            }
          }

          objectArray.push(node);
        });

        function childrenFromArray(array) {
          const childArray = [];

          array.forEach((talk) => {
            const node = {
              name: talk.speaker_1,
              children: [],
              value: 1,
              talkInfo: [talk],
            };

            childArray.push(node);
          });

          return childArray;
        }

        return objectArray;
      }

      result.push(...convertMapToObject(map));

      return result;
    }

    let hierObj = mapToNestedObject(hierarchicalData)

    // Convert the nested data to a hierarchical structure
    const pack = data => d3.pack()
      .size([vis.width, vis.height])
      .padding(3)
      (d3.hierarchy(data)
        .sum((d) => d.value)
        .sort((a, b) => b.value - a.value));

    // Apply the pack layout to the hierarchy data
    vis.root = pack(hierObj[0]);

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
        .attr("text-anchor", "middle")
        .text("No talks that meet your specifications");

      // Hide other chart elements
      vis.node.style("display", "none");
      vis.label.style("display", "none");

    } else {

      vis.svg
        .select(".no-data-message")
        .remove();

      vis.node = vis.chart
        .selectAll("circle")
        .data(vis.root.descendants())
        .join("circle")
        .attr("fill", d => vis.color(d.depth))
        .attr('class', 'cp-circle')
        .attr('opacity', '0.8')
        .style('display', 'block')
        .on("click", (event, d) => !d.children ? d.parent === focus ? window.open(d.data.talkInfo[0].public_url, '_blank').focus() : "none" : focus !== d && (zoom(d), event.stopPropagation()));

      // Append the text labels.
      vis.label = vis.chart
        .selectAll("text")
        .data(vis.root.descendants())
        .join("text")
        .style("fill-opacity", d => d.parent === vis.root ? 1 : 0)
        .style("display", d => d.parent === vis.root ? "block" : "none")
        .attr('class', 'cp-text')
        .text((d) => d.data.name);

      vis.label.raise();

      //zoom functionality
      vis.chart.on("click", () => zoom(vis.root));
      let focus = vis.root;
      let view = [focus.x, focus.y, focus.r * 2];
      zoom(focus);

      function zoomTo(v) {
        const k = vis.width / v[2];
        view = v

        vis.label.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k}) rotate(-15)`);
        vis.node.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
        vis.node.attr("r", d => d.r * k);
      }

      function zoom(d) {
        focus = d;
        vis.dispatcher.call('updateSelectedOccupations', {}, d);

        const transition = vis.chart.transition()
          .tween("zoom", () => {
            const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
            return t => zoomTo(i(t));
          });

        vis.label
          .filter(function (d) { return d.parent === focus || this.style.display === "inline"; })
          .transition(transition)
          .style("fill-opacity", d => d.parent === focus ? 1 : 0)
          .on("start", function (d) { if (d.parent === focus) this.style.display = "inline"; })
          .on("end", function (d) { if (d.parent !== focus || d.parent === null) this.style.display = "none"; });
      }

      // Tooltip Hover
      vis.node
        .on('mouseover', (event, d) => {
          if (!d.children && d.parent === focus) {
            const talkInfo = d.data.talkInfo[0]
            d3.select('#tooltip')
              .style('display', "block")
              .html(`<div class="tooltip-title">${(talkInfo.speaker_1)}</div>${talkInfo.headline}
              <div><i>${talkInfo.speaker1_occupation}</i></div>
                <ul>
                  <li>Duration: ${talkInfo.duration} minutes</li>
                  <li>Views: ${d3.format(',')(talkInfo.views)}</li>
                </ul>`);
          }
        })
        .on('mousemove', (event) => {
          d3.select('#tooltip')
            .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')
            .style('top', (event.pageY + vis.config.tooltipPadding) + 'px')
        })
        .on('mouseleave', () => {
          d3.select('#tooltip').style('display', "none");
        });

    }
  }
}