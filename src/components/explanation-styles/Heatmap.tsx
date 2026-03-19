'use client';

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Person {
  name: string;
  pattern: string;
  color: string;
}

interface Restaurant {
  id: number;
  name: string;
  visited: boolean;
}

type AggregationStrategy = 'LMS' | 'ADD' | 'APP';

interface HeatmapProps {
  people: Person[];
  restaurants: Restaurant[];
  ratings: number[][];
  strategy: AggregationStrategy;
  recommendedRestaurantIndices: number[];
  groupScores: number[];
  updateRating: (personIndex: number, restaurantIndex: number, value: number) => void;
  resetRatings: () => void;
}

export default function Heatmap({
  people,
  restaurants,
  ratings,
  strategy,
  recommendedRestaurantIndices,
  groupScores,
  updateRating,
}: HeatmapProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const colorScale = d3.scaleSequential()
    .domain([1, 5])
    .interpolator(d3.interpolateRdYlGn);

  const createHeatmap = () => {
    if (!chartRef.current || !svgRef.current) return;

    const container = chartRef.current;
    const svg = d3.select(svgRef.current);
    
    // Clear previous chart
    svg.selectAll("*").remove();

    // Get container dimensions
    const containerWidth = container.clientWidth;
    const margin = { top: 80, right: 20, bottom: 80, left: 100 };
    const width = containerWidth - margin.left - margin.right;
    const height = 400;

    // Set up SVG
    svg.attr("width", containerWidth).attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleBand()
      .domain(restaurants.map(r => r.name))
      .range([0, width])
      .paddingInner(0.05)
      .paddingOuter(0.1);

    const yScale = d3.scaleBand()
      .domain(people.map(p => p.name))
      .range([0, height])
      .paddingInner(0.05)
      .paddingOuter(0.1);

    const cells = g.selectAll(".cell")
      .data(ratings.flatMap((personRatings, personIndex) => 
        personRatings.map((rating, restaurantIndex) => ({
          personIndex,
          restaurantIndex,
          rating,
          person: people[personIndex],
          restaurant: restaurants[restaurantIndex]
        }))
      ))
      .enter()
      .append("g")
      .attr("class", "cell")
      .attr("transform", d => `translate(${xScale(d.restaurant.name)},${yScale(d.person.name)})`);

    cells.append("rect")
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("fill", d => colorScale(d.rating))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .attr("opacity", d => d.restaurant.visited ? 0.6 : 1)
      .style("cursor", d => d.restaurant.visited ? "default" : "pointer")
      .on("mouseover", function(event, d) {
        if (!d.restaurant.visited) {
          d3.select(this)
            .attr("stroke", "#333")
            .attr("stroke-width", 3);
        }
        
        // Show tooltip
        d3.select("body").selectAll(".heatmap-tooltip")
          .data([d])
          .join("div")
          .attr("class", "heatmap-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.8)")
          .style("color", "white")
          .style("padding", "8px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "1000")
          .html(`
            <strong>${d.person.name}</strong> → <strong>${d.restaurant.name}</strong><br/>
            Rating: <strong>${d.rating}/5</strong><br/>
            ${d.restaurant.visited ? 'Already visited' : 'Click to change rating'}
          `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function(event, d) {
        if (!d.restaurant.visited) {
          d3.select(this)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1);
        }
        
        // Remove tooltip
        d3.selectAll(".heatmap-tooltip").remove();
      })
      .on("click", function(event, d) {
        if (!d.restaurant.visited) {
          // Cycle through ratings 1-5
          const newRating = d.rating >= 5 ? 1 : d.rating + 1;
          updateRating(d.personIndex, d.restaurantIndex, newRating);
        }
      });

    // Add rating text on cells
    cells.append("text")
      .attr("x", xScale.bandwidth() / 2)
      .attr("y", yScale.bandwidth() / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .attr("fill", d => d.rating <= 2 ? "white" : "black")
      .attr("text-shadow", d => d.rating <= 2 ? "1px 1px 1px rgba(0,0,0,0.7)" : "1px 1px 1px rgba(255,255,255,0.7)")
      .style("pointer-events", "none")
      .text(d => d.rating);

    // Add X-axis (restaurant names)
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .style("font-size", "12px");

    // Add Y-axis (person names)
    g.append("g")
      .call(d3.axisLeft(yScale))
      .selectAll("text")
      .style("font-size", "12px");

    // Add recommended restaurant indicators
    recommendedRestaurantIndices.forEach(restaurantIndex => {
      const restaurant = restaurants[restaurantIndex];
      if (!restaurant) return;
      const x = xScale(restaurant.name)! + xScale.bandwidth() / 2;
      
      g.append("circle")
        .attr("cx", x)
        .attr("cy", -35)
        .attr("r", 8)
        .attr("fill", "#F59E0B")
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);

      g.append("text")
        .attr("x", x)
        .attr("y", -35)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text("★");
    });

    // Add visited restaurant indicators
    restaurants.forEach((restaurant) => {
      if (restaurant.visited) {
        const x = xScale(restaurant.name)! + xScale.bandwidth() / 2;
        
        g.append("rect")
          .attr("x", x - 6)
          .attr("y", -50)
          .attr("width", 12)
          .attr("height", 12)
          .attr("fill", "#6B7280")
          .attr("stroke", "#fff")
          .attr("stroke-width", 1);

        g.append("text")
          .attr("x", x)
          .attr("y", -40)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("font-size", "8px")
          .attr("font-weight", "bold")
          .attr("fill", "white")
          .text("V");
      }
    });

    // Add title
    g.append("text")
      .attr("x", width / 2)
      .attr("y", -35)
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .attr("fill", "#374151");

    // Add group scores at the top of each column
    restaurants.forEach((restaurant, index) => {
      const x = xScale(restaurant.name)! + xScale.bandwidth() / 2;
      const groupScore = groupScores[index];
      
      g.append("text")
        .attr("x", x)
        .attr("y", -50)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "#6B7280")
        .text(`${groupScore}`);
    });
  };

  // Effect to create/update heatmap
  useEffect(() => {
    createHeatmap();
  }, [ratings, recommendedRestaurantIndices, restaurants, people]);

  // Effect to handle window resize
  useEffect(() => {
    const handleResize = () => {
      createHeatmap();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [ratings, recommendedRestaurantIndices, restaurants, people]);

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 max-h-[calc(100vh-20rem)] overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Heatmap Explanation</h3>
        <p className="text-sm text-gray-600 mb-4">
          Each cell shows a person&apos;s rating for a restaurant. Color intensity represents rating value (red = low, green = high). 
          Click cells to change ratings (1-5 cycle).
        </p>
      </div>

      {/* Heatmap Container */}
      <div 
        ref={chartRef}
        className="w-full overflow-x-auto"
        style={{ minHeight: '500px' }}
      >
        <svg ref={svgRef} />
      </div>

      {/* Legend and Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm mt-6">
        <div>
          <h4 className="font-semibold mb-2">Color Scale:</h4>
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: colorScale(1) }} />
            <span>1 (Lowest)</span>
          </div>
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: colorScale(3) }} />
            <span>3 (Neutral)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: colorScale(5) }} />
            <span>5 (Highest)</span>
          </div>
        </div>
        
        <div>
          <h4 className="font-semibold mb-2">Indicators:</h4>
          <div className="flex items-center mb-1">
            <div className="w-4 h-4 mr-2 bg-gray-400 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">V</span>
            </div>
            <span>Already visited</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 mr-2 bg-orange-400 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">★</span>
            </div>
            <span>Recommended restaurant</span>
          </div>
        </div>
        
        <div>
          <h4 className="font-semibold mb-2">Strategy ({strategy}):</h4>
          {strategy === 'LMS' && (
            <div className="text-xs text-gray-600">
              <p>• Focus on lowest ratings (red cells)</p>
              <p>• Avoid restaurants with very low ratings</p>
            </div>
          )}
          {strategy === 'ADD' && (
            <div className="text-xs text-gray-600">
              <p>• Sum all ratings for each restaurant</p>
              <p>• Green cells contribute more to total</p>
            </div>
          )}
          {strategy === 'APP' && (
            <div className="text-xs text-gray-600">
              <p>• Only count ratings above 3</p>
              <p>• Green and yellow cells matter most</p>
            </div>
          )}
          <div className="text-xs text-gray-600 mt-2">
            💡 Click cells to change ratings
          </div>
        </div>
      </div>
    </div>
  );
}
