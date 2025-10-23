import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface TokenUsageDisplayProps {
    monthlyTokenUsage?: number;
    monthlyTokenLimit?: number;
    dailyTokenUsage?: number;
    dailyTokenLimit?: number;
    className?: string;
}

export function TokenUsageDisplay({
    monthlyTokenUsage,
    monthlyTokenLimit,
    dailyTokenUsage,
    dailyTokenLimit,
    className,
}: TokenUsageDisplayProps) {
    // If no limits are set, don't display the component
    if (!monthlyTokenLimit && !dailyTokenLimit) {
        return null;
    }
    // Calculate percentages for the progress bars
    const monthlyPercentage =
        monthlyTokenLimit && monthlyTokenUsage !== undefined
            ? Math.min(
                  Math.round((monthlyTokenUsage / monthlyTokenLimit) * 100),
                  100,
              )
            : 0;

    const dailyPercentage =
        dailyTokenLimit && dailyTokenUsage !== undefined
            ? Math.min(
                  Math.round((dailyTokenUsage / dailyTokenLimit) * 100),
                  100,
              )
            : 0;

    // Determine color based on usage percentage
    const getColorClass = (percentage: number) => {
        // amazonq-ignore-next-line
        if (percentage >= 90) return "bg-red-500";
        // amazonq-ignore-next-line
        if (percentage >= 75) return "bg-amber-500";
        return "bg-primary";
    };

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            {/* Monthly Usage Section */}
            {monthlyTokenLimit && monthlyTokenUsage !== undefined && (
                <div className="flex flex-col gap-2">
                    {/* Section heading */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">
                            Monthly Usage
                        </span>
                        <span className="text-muted-foreground">
                            {monthlyPercentage}%
                        </span>
                    </div>

                    {/* Usage numbers */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{monthlyTokenUsage.toLocaleString()}</span>
                        <span>{monthlyTokenLimit.toLocaleString()}</span>
                    </div>

                    {/* Progress bar */}
                    <Progress
                        value={monthlyPercentage}
                        className={cn(
                            "h-2 w-full",
                            getColorClass(monthlyPercentage),
                        )}
                    />
                </div>
            )}

            {/* Daily Usage Section */}
            {dailyTokenLimit && dailyTokenUsage !== undefined && (
                <div className="flex flex-col gap-2">
                    {/* Section heading */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">
                            Daily Usage
                        </span>
                        <span className="text-muted-foreground">
                            {dailyPercentage}%
                        </span>
                    </div>

                    {/* Usage numbers */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{dailyTokenUsage.toLocaleString()}</span>
                        <span>{dailyTokenLimit.toLocaleString()}</span>
                    </div>

                    {/* Progress bar */}
                    <Progress
                        value={dailyPercentage}
                        className={cn(
                            "h-2 w-full",
                            getColorClass(dailyPercentage),
                        )}
                    />
                </div>
            )}
        </div>
    );
}
