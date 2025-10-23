// Model types
export interface Model {
    id: string;
    name: string;
    providerName: string;
    inferenceProfileId: string;
    foundationModelId: string;
    contextWindow?: string;
}

// Group models by provider
export interface ModelGroup {
    providerName: string;
    models: Model[];
}

// Models data loaded from deployed JSON
interface ModelsData {
    models: Model[];
    defaultModelId: string;
}

// Group models by provider
export function groupModelsByProvider(models: Model[]): ModelGroup[] {
    const groupsMap = new Map<string, Model[]>();

    // Group models by provider
    models.forEach((model) => {
        if (!groupsMap.has(model.providerName)) {
            groupsMap.set(model.providerName, []);
        }
        groupsMap.get(model.providerName)?.push(model);
    });

    // Convert map to array of ModelGroup objects
    return Array.from(groupsMap.entries()).map(([providerName, models]) => ({
        providerName,
        models: models.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

// Load models data from deployed JSON file
export async function loadModelsData(): Promise<ModelsData> {
    try {
        const response = await fetch("/models.json");
        if (!response.ok) {
            throw new Error(
                `Failed to load models data: ${response.statusText}`,
            );
        }
        return await response.json();
    } catch (error) {
        console.error("Error loading models data:", error);
        // Return fallback data if loading fails
        return {
            models: [],
            defaultModelId: "us.anthropic.claude-sonnet-4-20250514-v1:0",
        };
    }
}
