/**
 * Based on TasteWeights with one feature (rating) https://dl.acm.org/doi/10.1145/2365952.2365964
 * Ratings for items in table 6 of https://dl.acm.org/doi/10.1145/3555161
 */

"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { CheckIcon } from "lucide-react";

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

type AggregationStrategy = "LMS" | "ADD" | "APP";

interface GraphSlidersProps {
  people: Person[];
  restaurants: Restaurant[];
  ratings: number[][];
  strategy: AggregationStrategy;
  recommendedRestaurantIndices: number[];
  groupScores: number[];
  updateRating: (
    personIndex: number,
    restaurantIndex: number,
    value: number
  ) => void;
  resetRatings: () => void;
  fadeNonContributing?: boolean;
  onRatingChange?: (event: {
    personIndex: number;
    restaurantIndex: number;
    value: number;
  }) => void;
}

export default function GraphSliders({
  people,
  restaurants,
  ratings,
  strategy,
  recommendedRestaurantIndices,
  groupScores,
  updateRating,
  resetRatings,
  fadeNonContributing = true,
  onRatingChange,
}: GraphSlidersProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Helper function to determine if a bar should be faded based on strategy
  const shouldFadeBar = (
    personIndex: number,
    restaurantIndex: number,
    rating: number
  ): boolean => {
    if (!fadeNonContributing) return false;

    const restaurantRatings = ratings.map(
      (personRatings) => personRatings[restaurantIndex]
    );

    switch (strategy) {
      case "LMS": // Least Misery Strategy - fade bars higher than the minimum
        const minRating = Math.min(...restaurantRatings);
        return rating > minRating;

      case "APP": // Approval Voting Strategy - fade bars with rating <= 3
        return rating <= 3;

      case "ADD": // Additive Strategy - all bars contribute, so nothing is faded
        return false;

      default:
        return false;
    }
  };

  // Create D3 chart
  const createChart = () => {
    if (!chartRef.current || !svgRef.current) return;

    const container = chartRef.current;
    const svg = d3.select(svgRef.current);

    // Clear previous chart
    svg.selectAll("*").remove();

    // Get container dimensions
    const containerWidth = container.clientWidth;
    const margin = { top: 20, right: 20, bottom: 80, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = 280;

    // Set up SVG
    svg
      .attr("width", containerWidth)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3
      .scaleBand()
      .domain(restaurants.map((r) => r.name))
      .range([0, width])
      .paddingInner(0.1)
      .paddingOuter(0.1);

    const yScale = d3.scaleLinear().domain([0, 5]).range([height, 0]);

    const personScale = d3
      .scaleBand()
      .domain(people.map((p) => p.name))
      .range([0, xScale.bandwidth()])
      .paddingInner(0.1);

    // Create drag behavior with better precision
    interface BarDatum {
      personIndex: number;
      restaurantIndex: number;
      rating: number;
      person: string;
      restaurant: string;
    }
    const drag = d3
      .drag<SVGRectElement, BarDatum>()
      .on("start", function (_event, d) {
        const shouldFade = shouldFadeBar(
          d.personIndex,
          d.restaurantIndex,
          d.rating
        );
        d3.select(this)
          .attr("opacity", shouldFade ? 0.5 : 0.8)
          .attr("stroke", "#3B82F6")
          .attr("stroke-width", 2);
      })
      .on("drag", function (event, d) {
        // Move bar visually during drag without triggering full React redraw
        const pointer = d3.pointer(event, g.node() as SVGGElement);
        const pointerY = pointer[1];
        const clampedY = Math.max(0, Math.min(height, pointerY));
        d3.select(this)
          .attr("y", clampedY)
          .attr("height", height - clampedY);
      })
      .on("end", function (event, d) {
        const shouldFade = shouldFadeBar(
          d.personIndex,
          d.restaurantIndex,
          d.rating
        );
        d3.select(this)
          .attr("opacity", shouldFade ? 0.3 : 1)
          .attr("stroke", "none");

        // On drag end, update state with rounded value (single redraw)
        const pointer = d3.pointer(event, g.node() as SVGGElement);
        const pointerY = pointer[1];
        const clampedY = Math.max(0, Math.min(height, pointerY));
        const continuousRating = 5 - (clampedY / height) * 4;
        const newRating = Math.max(
          1,
          Math.min(5, Math.round(continuousRating))
        );
        updateRating(d.personIndex, d.restaurantIndex, newRating);
        onRatingChange?.({
          personIndex: d.personIndex,
          restaurantIndex: d.restaurantIndex,
          value: newRating,
        });
      });

    // Draw bars
    restaurants.forEach((restaurant, restaurantIndex) => {
      const isRecommended =
        recommendedRestaurantIndices.includes(restaurantIndex);
      const isVisited = restaurant.visited;
      const groupScore = groupScores[restaurantIndex];

      // Restaurant group
      const restaurantGroup = g
        .append("g")
        .attr("class", "restaurant-group")
        .attr("transform", `translate(${xScale(restaurant.name)}, 0)`);

      // Background for visited/recommended restaurants
      if (isVisited || isRecommended) {
        restaurantGroup
          .append("rect")
          .attr("x", 0)
          .attr("y", 0)
          .attr("width", xScale.bandwidth())
          .attr("height", height)
          .attr("fill", isVisited ? "#E5E7EB" : "#FFEA00")
          .attr("opacity", 0.3);
      }

      // Add checkmark for recommended restaurants (color blind accessible)
      if (isRecommended && !isVisited) {
        const checkmarkSize = 16;
        const checkmarkX = xScale.bandwidth() / 2;
        const checkmarkY = -25; // Position above the chart area

        // Create checkmark group
        const checkmarkGroup = restaurantGroup
          .append("g")
          .attr("transform", `translate(${checkmarkX}, ${checkmarkY})`)
          .attr("class", "recommended-checkmark");

        // Background circle for checkmark
        checkmarkGroup
          .append("circle")
          .attr("r", checkmarkSize / 2 + 2)
          .attr("fill", "#10B981") // Green color
          .attr("stroke", "#fff")
          .attr("stroke-width", 2);

        // Checkmark path
        checkmarkGroup
          .append("path")
          .attr("d", "M -6,-2 L -2,2 L 6,-6")
          .attr("stroke", "#fff")
          .attr("stroke-width", 2.5)
          .attr("stroke-linecap", "round")
          .attr("stroke-linejoin", "round")
          .attr("fill", "none");
      }

      // Individual bars
      people.forEach((person, personIndex) => {
        const rating = ratings[personIndex][restaurantIndex];
        const barHeight = height - yScale(rating);
        const barY = yScale(rating);

        const personX = personScale(person.name) || 0;
        const personWidth = personScale.bandwidth() || 0;

        const shouldFade = shouldFadeBar(personIndex, restaurantIndex, rating);
        restaurantGroup
          .append("rect")
          .attr("x", personX)
          .attr("y", barY)
          .attr("width", personWidth)
          .attr("height", barHeight)
          .attr("fill", isVisited ? "#6B7280" : person.color)
          .attr("opacity", isVisited ? 0.6 : shouldFade ? 0.3 : 1)
          .attr("cursor", "ns-resize")
          .datum({
            personIndex,
            restaurantIndex,
            rating,
            person: person.name,
            restaurant: restaurant.name,
          })
          .on("mouseover", function () {
            if (!isVisited) {
              d3.select(this)
                .attr("opacity", shouldFade ? 0.5 : 0.8)
                .attr("stroke", "#3B82F6")
                .attr("stroke-width", 1);
            }
          })
          .on("mouseout", function () {
            if (!isVisited) {
              d3.select(this)
                .attr("opacity", shouldFade ? 0.3 : 1)
                .attr("stroke", "none");
            }
          })
          // Enable dragging only for non-visited restaurants
          .call(isVisited ? () => { } : drag);

        // Add rating text only if bar is tall enough
        if (barHeight > 20) {
          restaurantGroup
            .append("text")
            .attr("x", personX + personWidth / 2)
            .attr("y", barY + barHeight / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-size", "10px")
            .attr("font-weight", "bold")
            .attr("fill", "white")
            .attr("text-shadow", "1px 1px 1px rgba(0,0,0,0.5)")
            .text(rating);
        } else {
          // For short bars, place text above
          restaurantGroup
            .append("text")
            .attr("x", personX + personWidth / 2)
            .attr("y", barY - 3)
            .attr("text-anchor", "middle")
            .attr("font-size", "9px")
            .attr("font-weight", "bold")
            .attr("fill", "#374151")
            .text(rating);
        }
      });

      // Group score visualization based on strategy
      if (strategy === "LMS") {
        // For LMS, show the minimum rating line
        const groupScoreY = yScale(groupScore);
        restaurantGroup
          .append("line")
          .attr("x1", 0)
          .attr("x2", xScale.bandwidth())
          .attr("y1", groupScoreY)
          .attr("y2", groupScoreY)
          .attr("stroke", "#EF4444")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "5,5");

        // Group score text
        restaurantGroup
          .append("text")
          .attr("x", xScale.bandwidth() / 2)
          .attr("y", groupScoreY - 8)
          .attr("text-anchor", "middle")
          .attr("font-size", "11px")
          .attr("font-weight", "800")
          .attr("fill", "#EF4444")
          .attr("background", "white")
          .attr("stroke", "white")
          .attr("stroke-width", "4px")
          .attr("paint-order", "stroke fill")
          .text(groupScore);
      } else if (strategy === "ADD") {
        // For ADD, show the sum as a scaled line with total score overlayed
        // Scale the group score to fit within the 0-5 rating scale for visualization
        const maxPossibleSum = people.length * 5; // Maximum possible sum
        const scaledScore = (groupScore / maxPossibleSum) * 5; // Scale to 0-5 range
        const groupScoreY = yScale(scaledScore);

        restaurantGroup
          .append("line")
          .attr("x1", 0)
          .attr("x2", xScale.bandwidth())
          .attr("y1", groupScoreY)
          .attr("y2", groupScoreY)
          .attr("stroke", "#000000")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "5,5");

        // Group score text showing the actual sum
        restaurantGroup
          .append("text")
          .attr("x", xScale.bandwidth() / 2)
          .attr("y", groupScoreY - 8)
          .attr("text-anchor", "middle")
          .attr("font-size", "11px")
          .attr("font-weight", "800")
          .attr("fill", "#000000")
          .attr("background", "white")
          .attr("stroke", "white")
          .attr("stroke-width", "4px")
          .attr("paint-order", "stroke fill")
          .text(groupScore);
      } else {
        // For APP, show the approval votes as a scaled line with count overlayed
        // Scale the group score (number of approval votes) to fit within the 0-5 rating scale for visualization
        const maxPossibleVotes = people.length; // Maximum possible approval votes
        const scaledScore = (groupScore / maxPossibleVotes) * 5; // Scale to 0-5 range
        const groupScoreY = yScale(scaledScore);

        restaurantGroup
          .append("line")
          .attr("x1", 0)
          .attr("x2", xScale.bandwidth())
          .attr("y1", groupScoreY)
          .attr("y2", groupScoreY)
          .attr("stroke", "#000000")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "5,5");

        // Group score text showing the actual approval votes count
        restaurantGroup
          .append("text")
          .attr("x", xScale.bandwidth() / 2)
          .attr("y", groupScoreY - 8)
          .attr("text-anchor", "middle")
          .attr("font-size", "11px")
          .attr("font-weight", "800")
          .attr("fill", "#000000")
          .attr("background", "white")
          .attr("stroke", "white")
          .attr("stroke-width", "4px")
          .attr("paint-order", "stroke fill")
          .text(groupScore);
      }
    });

    // Y-axis
    g.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(yScale).ticks(6))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -40)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text("Rating");

    // X-axis
    const xAxis = g
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(xScale));

    // Style the text labels
    const xText = xAxis.selectAll<SVGTextElement, string>("text");
    xText
      .attr("font-size", "12px")
      .style("fill", "#000000") // Keep text black
      .each(function (_d, i) {
        if (!recommendedRestaurantIndices.includes(i)) return;
        // Add yellow background for recommended restaurants
        const bbox = (this as SVGTextElement).getBBox();
        const padding = 2;
        const parent = (this as SVGTextElement)
          .parentNode as SVGGElement | null;
        if (!parent) return;
        // Insert background rectangle before the text
        d3.select(parent)
          .insert("rect", "text")
          .attr("x", bbox.x - padding)
          .attr("y", bbox.y - padding)
          .attr("width", bbox.width + 2 * padding)
          .attr("height", bbox.height + 2 * padding)
          .attr("fill", "#FFFF00")
          .attr("rx", 2); // Rounded corners

        // Add checkmark next to restaurant name for color blind accessibility
        const checkmarkSize = 12;
        const checkmarkX = bbox.x + bbox.width + 8;
        const checkmarkY = bbox.y + bbox.height / 2;

        const checkmarkGroup = d3.select(parent)
          .append("g")
          .attr("transform", `translate(${checkmarkX}, ${checkmarkY})`)
          .attr("class", "recommended-checkmark-label");

        // Background circle for checkmark
        checkmarkGroup
          .append("circle")
          .attr("r", checkmarkSize / 2 + 1)
          .attr("fill", "#10B981") // Green color
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5);

        // Checkmark path
        checkmarkGroup
          .append("path")
          .attr("d", "M -4,-1.5 L -1.5,1.5 L 4,-4.5")
          .attr("stroke", "#fff")
          .attr("stroke-width", 2)
          .attr("stroke-linecap", "round")
          .attr("stroke-linejoin", "round")
          .attr("fill", "none");
      });
  };

  // Effect to create/update chart
  useEffect(() => {
    createChart();
  }, [
    ratings,
    recommendedRestaurantIndices,
    groupScores,
    strategy,
    fadeNonContributing,
  ]);

  // Effect to handle window resize
  useEffect(() => {
    const handleResize = () => {
      createChart();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [
    ratings,
    recommendedRestaurantIndices,
    groupScores,
    strategy,
    fadeNonContributing,
  ]);

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 max-h-[calc(100vh-20rem)] overflow-y-auto">
      {/* D3 Chart Container */}
      <div
        ref={chartRef}
        className="w-full overflow-x-auto"
        style={{ minHeight: "360px" }}
        data-onboarding="interactive-graph"
      >
        <svg ref={svgRef} className="w-full h-full"></svg>
      </div>

      {/* Legend */}
      <details className="mt-0">
        <summary className="cursor-pointer text-sm font-semibold text-gray-700 select-none">
          Legend
        </summary>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-2 gap-4 text-sm w-[80%] min-w-[400px] mx-auto">
          <div>
            <div className="grid grid-cols-2 gap-1">
              {people.map((person) => (
                <div key={person.name} className="flex items-center mb-1">
                  <div
                    className="w-4 h-4 mr-2 rounded"
                    style={{ backgroundColor: person.color }}
                  />
                  <span>{person.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center mb-1">
              <div className="w-4 h-4 mr-2 bg-gray-400 rounded" />
              <span>Restaurants already visited</span>
            </div>
            <div className="flex items-center mb-1">
              <div className="w-4 h-4 mr-2 bg-yellow-200 rounded" />
              <span>Recommended restaurant</span>
              <CheckIcon className="w-3 h-3 ml-2 text-white bg-green-500 rounded-full" />
            </div>
            {strategy === "LMS" && (
              <div className="flex items-center mb-1">
                <div className="w-4 h-0.5 mr-2 border-t-2 border-dashed border-red-500" />
                <span>Group score: lowest rating</span>
              </div>
            )}
            {strategy === "ADD" && (
              <div className="flex items-center mb-1">
                <div className="w-4 h-0.5 mr-2 border-t-2 border-dashed border-black" />
                <span>Group score: total rating for the restaurant</span>
              </div>
            )}
            {strategy === "APP" && (
              <div className="flex items-center mb-1">
                <div className="w-4 h-0.5 mr-2 border-t-2 border-dashed border-black" />
                <span>
                  Group score: number of ratings above 3 for the restaurant
                </span>
              </div>
            )}
            <div className="text-xs text-gray-600 mt-2">
              💡 Drag bars up/down to change ratings
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
