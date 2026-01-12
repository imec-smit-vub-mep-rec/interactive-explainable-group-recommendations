/**
 * Based on https://ieeexplore.ieee.org/abstract/document/8053925
 * Also mentioned in Fig. 7 of https://dl.acm.org/doi/10.1145/3555161
 */
"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

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

interface PieExplanationProps {
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
}

export default function PieExplanation({
  people,
  restaurants,
  ratings,
  strategy,
  recommendedRestaurantIndices,
  groupScores,
  updateRating,
  resetRatings,
}: PieExplanationProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  // Helper function to get pie chart data based on strategy
  const getPieData = (restaurantIndex: number) => {
    const restaurantRatings = ratings.map((personRatings, personIndex) => ({
      person: people[personIndex],
      rating: personRatings[restaurantIndex],
      personIndex,
    }));

    switch (strategy) {
      case "LMS": // Least Misery Strategy - only show lowest rating
        const minRating = Math.min(...restaurantRatings.map((r) => r.rating));
        const lowestRaters = restaurantRatings.filter(
          (r) => r.rating === minRating
        );
        return lowestRaters.map((r) => ({
          person: r.person,
          rating: r.rating,
          personIndex: r.personIndex,
          value: 1, // Equal slices for all lowest raters
        }));

      case "ADD": // Additive Strategy - show all ratings, size by rating value
        return restaurantRatings.map((r) => ({
          person: r.person,
          rating: r.rating,
          personIndex: r.personIndex,
          value: r.rating,
        }));

      case "APP": // Approval Voting - only ratings > 3, equal slices
        const approvalRatings = restaurantRatings.filter((r) => r.rating > 3);
        return approvalRatings.map((r) => ({
          person: r.person,
          rating: r.rating,
          personIndex: r.personIndex,
          value: 1, // Equal slices for all approval votes
        }));

      default:
        return [];
    }
  };

  // Helper function to calculate pie chart size based on group score
  const getPieSize = (groupScore: number) => {
    const maxScore = Math.max(...groupScores);
    const minSize = 60;
    const maxSize = 120;
    if (maxScore === 0) return minSize;
    return minSize + (groupScore / maxScore) * (maxSize - minSize);
  };

  // Create pie charts
  const createPieCharts = () => {
    if (!chartRef.current) return;

    const container = chartRef.current;
    container.innerHTML = "";

      const chartSize = 140;

    restaurants.forEach((restaurant, restaurantIndex) => {
      const isRecommended =
        recommendedRestaurantIndices.includes(restaurantIndex);
      const isVisited = restaurant.visited;
      const groupScore = groupScores[restaurantIndex];
      const pieData = getPieData(restaurantIndex);

      // Skip restaurants with no data for the current strategy
      if (pieData.length === 0) return;

      // Create chart container
      const chartContainer = document.createElement("div");
      chartContainer.className = "inline-block m-2 text-center";
      chartContainer.style.position = "relative";

      // Create SVG
      const svg = d3
        .select(chartContainer)
        .append("svg")
        .attr("width", chartSize)
        .attr("height", chartSize + 40);

      const pieSize = getPieSize(groupScore);
      const centerX = chartSize / 2;
      const centerY = (chartSize - 20) / 2;

      interface PieDatum {
        person: Person;
        rating: number;
        personIndex: number;
        value: number;
      }
      // Create pie generator
      const pie = d3
        .pie<PieDatum>()
        .value((d) => d.value)
        .sort(null);

      // Create arc generator
      const arc = d3
        .arc<d3.PieArcDatum<PieDatum>>()
        .innerRadius(0)
        .outerRadius(pieSize / 2);

      // Create pie chart group
      const pieGroup = svg
        .append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`);

      // Add background circle for visited/recommended restaurants
      if (isVisited || isRecommended) {
        pieGroup
          .append("circle")
          .attr("r", pieSize / 2 + 5)
          .attr("fill", isVisited ? "#E5E7EB" : "#FFEA00")
          .attr("opacity", 0.3);
      }

      // Create pie slices
      const arcs = pieGroup
        .selectAll(".arc")
        .data(pie(pieData))
        .enter()
        .append("g")
        .attr("class", "arc");

      arcs
        .append("path")
        .attr("d", arc)
        .attr("fill", (d) => d.data.person.color)
        .attr("opacity", isVisited ? 0.6 : 1)
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .style("cursor", isVisited ? "default" : "pointer")
        .on("mouseover", function () {
          if (!isVisited) {
            d3.select(this).attr("opacity", 0.8).attr("stroke-width", 3);
          }
        })
        .on("mouseout", function () {
          if (!isVisited) {
            d3.select(this).attr("opacity", 1).attr("stroke-width", 2);
          }
        })
        .on("click", function (event, d) {
          if (!isVisited) {
            // Cycle through ratings 1-5
            const currentRating = d.data.rating;
            const newRating = currentRating >= 5 ? 1 : currentRating + 1;
            updateRating(d.data.personIndex, restaurantIndex, newRating);
          }
        });

      // Add rating text on slices (only if slice is large enough)
      arcs
        .append("text")
        .attr("transform", (d) => `translate(${arc.centroid(d)})`)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .attr("text-shadow", "1px 1px 1px rgba(0,0,0,0.7)")
        .style("pointer-events", "none")
        .text((d) => {
          // Only show rating if slice is large enough
          const angle = d.endAngle - d.startAngle;
          return angle > 0.3 ? d.data.rating : "";
        });

      // Add restaurant name
      svg
        .append("text")
        .attr("x", centerX)
        .attr("y", chartSize - 5)
        .attr("text-anchor", "middle")
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .attr("fill", isRecommended ? "#B45309" : "#374151")
        .text(restaurant.name);

      // Add group score
      svg
        .append("text")
        .attr("x", centerX)
        .attr("y", chartSize + 15)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .attr("fill", "#6B7280")
        .text(`Score: ${groupScore}`);

      // Add recommended indicator
      if (isRecommended) {
        svg
          .append("circle")
          .attr("cx", centerX + pieSize / 2 - 5)
          .attr("cy", centerY - pieSize / 2 + 5)
          .attr("r", 8)
          .attr("fill", "#F59E0B")
          .attr("stroke", "#fff")
          .attr("stroke-width", 2);

        svg
          .append("text")
          .attr("x", centerX + pieSize / 2 - 5)
          .attr("y", centerY - pieSize / 2 + 5)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("font-size", "10px")
          .attr("font-weight", "bold")
          .attr("fill", "white")
          .text("★");
      }

      container.appendChild(chartContainer);
    });
  };

  // Effect to create/update charts
  useEffect(() => {
    createPieCharts();
  }, [ratings, recommendedRestaurantIndices, groupScores, strategy]);

  // Effect to handle window resize
  useEffect(() => {
    const handleResize = () => {
      createPieCharts();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [ratings, recommendedRestaurantIndices, groupScores, strategy]);

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 max-h-[calc(100vh-20rem)] overflow-y-auto">
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-4">
          Each pie chart represents a restaurant. Chart size reflects the group
          score. Click on slices to change ratings (1-5 cycle).
        </p>
      </div>

      {/* Pie Charts Container */}
      <div
        ref={chartRef}
        className="flex flex-wrap justify-center items-start gap-4"
        style={{ minHeight: "300px" }}
      />

      {/* Legend */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mt-6">
        <div>
          <h4 className="font-semibold mb-2">People:</h4>
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

        <div>
          <h4 className="font-semibold mb-2">Restaurant States:</h4>
          <div className="flex items-center mb-1">
            <div className="w-4 h-4 mr-2 bg-gray-400 rounded" />
            <span>Restaurants already visited</span>
          </div>
          <div className="flex items-center mb-1">
            <div className="w-4 h-4 mr-2 bg-yellow-200 rounded" />
            <span>Recommended restaurant</span>
          </div>
          <div className="flex items-center mb-1">
            <div className="w-4 h-4 mr-2 bg-orange-400 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">★</span>
            </div>
            <span>Recommended indicator</span>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Strategy ({strategy}):</h4>
          {strategy === "LMS" && (
            <div className="text-xs text-gray-600">
              <p>• Shows only the lowest rating(s)</p>
              <p>• Chart size based on minimum rating</p>
            </div>
          )}
          {strategy === "ADD" && (
            <div className="text-xs text-gray-600">
              <p>• Shows all ratings</p>
              <p>• Slice size proportional to rating</p>
              <p>• Chart size based on sum of ratings</p>
            </div>
          )}
          {strategy === "APP" && (
            <div className="text-xs text-gray-600">
              <p>• Shows only ratings above 3</p>
              <p>• Equal slice sizes</p>
              <p>• Chart size based on approval count</p>
            </div>
          )}
          <div className="text-xs text-gray-600 mt-2">
            💡 Click slices to change ratings
          </div>
        </div>
      </div>
    </div>
  );
}
