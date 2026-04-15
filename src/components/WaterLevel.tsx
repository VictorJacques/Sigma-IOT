import { motion } from 'motion/react';

interface WaterLevelProps {
  percentage: number;
}

export default function WaterLevel({ percentage }: WaterLevelProps) {
  const level = Math.min(100, Math.max(0, percentage));

  return (
    <div className="w-[180px] h-[280px] border-4 border-border-gray rounded-[12px] relative overflow-hidden bg-[#F9FAFB]">
      {/* Water Level */}
      <motion.div
        className="absolute bottom-0 left-0 w-full bg-gradient-to-b from-[#60A5FA] to-[#2563EB]"
        initial={{ height: 0 }}
        animate={{ height: `${level}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Water Line */}
        <div className="absolute top-0 w-full h-[2px] bg-white/30" />
      </motion.div>
    </div>
  );
}
