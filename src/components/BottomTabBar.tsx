import React from "react";
import { 
  Home, 
  PieChart, 
  Compass, 
  Zap, 
  ShieldCheck, 
  Calendar, 
  BookOpen,
  Sparkles,
  Clock,
  TrendingUp
} from "lucide-react";

interface BottomTabBarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const tabs = [
    { id: "home", label: "상황판", icon: Home },
    { id: "daily-check", label: "일일전략", icon: Clock },
    { id: "chart", label: "차트", icon: TrendingUp },
    { id: "gatekeeper", label: "Gatekeeper", icon: ShieldCheck, highlight: true },
    { id: "portfolio", label: "포트폴리오", icon: PieChart },
    { id: "sgov", label: "SGOV", icon: Zap },
    { id: "journal", label: "저널", icon: BookOpen },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-t border-stone-200 dark:border-stone-800 transition-colors">
      <div className="max-w-lg mx-auto px-1 flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.highlight) {
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className="relative -top-2 flex flex-col items-center group"
              >
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md transition-all ${
                    isActive
                      ? "bg-amber-500 text-stone-950 scale-105"
                      : "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors ${
                isActive
                  ? "text-blue-600 dark:text-blue-400 font-bold"
                  : "text-stone-600 hover:text-stone-800 dark:text-stone-300 dark:hover:text-stone-100 font-medium"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "scale-110" : ""} transition-transform`} />
              <span className="text-[10px] mt-0.5 whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
