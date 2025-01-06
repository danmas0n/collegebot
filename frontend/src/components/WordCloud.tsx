import React, { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';
import cloud from 'd3-cloud';
import { Box } from '@mui/material';
import { WordCloudWord } from '../types/college';

interface WordCloudProps {
  words: WordCloudWord[];
  width?: number;
  height?: number;
}

export const WordCloud: React.FC<WordCloudProps> = ({ 
  words, 
  width = 500, 
  height = 300 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!words.length || !svgRef.current) return;

    if (!svgRef.current || !words.length) return;
    
    // Clear previous content
    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const layout = cloud()
      .size([width, height])
      .words(words.map(w => ({
        text: w.text,
        size: 10 + Math.sqrt(w.value) * 10, // Scale font size based on value
        value: w.value
      })))
      .padding(5)
      .rotate(() => 0)
      .fontSize(d => d.size!)
      .on("end", draw);

    layout.start();

    function draw(words: any[]) {
      if (!svgRef.current) return;
      const svg = select(svgRef.current);
      
      const g = svg
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width/2},${height/2})`);

      g.selectAll("text")
        .data(words)
        .enter()
        .append("text")
        .style("font-size", d => `${d.size}px`)
        .style("font-family", "Impact")
        .style("fill", (_, i) => schemeCategory10[i % 10])
        .attr("text-anchor", "middle")
        .attr("transform", d => `translate(${d.x},${d.y}) rotate(${d.rotate})`)
        .text(d => d.text)
        .style("cursor", "pointer")
        .on("mouseover", function(this: SVGTextElement) {
          select(this).style("opacity", 0.7);
        })
        .on("mouseout", function(this: SVGTextElement) {
          select(this).style("opacity", 1);
        });
    }
  }, [words, width, height]);

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center' }}>
      <svg ref={svgRef} />
    </Box>
  );
};
