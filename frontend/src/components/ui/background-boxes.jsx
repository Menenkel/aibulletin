"use client";
import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

export const BoxesCore = ({ className, ...rest }) => {
  const rows = new Array(20).fill(1);
  const cols = new Array(30).fill(1);
  
  // Colors that work well in both light and dark modes
  let colors = [
    "#3b82f6", // blue-500
    "#8b5cf6", // violet-500
    "#06b6d4", // cyan-500
    "#10b981", // emerald-500
    "#f59e0b", // amber-500
    "#ef4444", // red-500
    "#ec4899", // pink-500
    "#84cc16", // lime-500
    "#6366f1", // indigo-500
  ];
  
  const getRandomColor = () => {
    return colors[Math.floor(Math.random() * colors.length)];
  };

  return (
    <div
      className={cn(
        "absolute inset-0 z-0 grid h-full w-full gap-2 p-4",
        className
      )}
      style={{
        gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
        gridTemplateRows: `repeat(${rows.length}, 1fr)`,
      }}
      {...rest}
    >
      {rows.map((_, i) => (
        cols.map((_, j) => {
          const randomColor = getRandomColor();
          return (
            <motion.div
              key={`${i}-${j}`}
              className="relative h-full w-full rounded-md border border-slate-300/30 dark:border-slate-600/30 bg-white/10 dark:bg-black/10 backdrop-blur-sm"
              style={{
                backgroundColor: `${randomColor}20`,
                borderColor: `${randomColor}40`,
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.3,
                delay: (i + j) * 0.01,
              }}
              whileHover={{
                scale: 1.1,
                backgroundColor: `${randomColor}40`,
                borderColor: `${randomColor}80`,
                transition: { duration: 0.2 }
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium opacity-60">+</span>
              </div>
            </motion.div>
          );
        })
      ))}
    </div>
  );
};

export const Boxes = React.memo(BoxesCore); 