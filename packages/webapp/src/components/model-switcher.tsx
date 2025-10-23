import * as React from "react";
import { ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Model, ModelGroup } from "@/lib/models";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function ModelSwitcher({
  models,
  modelGroups,
  selectedModel,
  onModelChange,
}: {
  models: Model[];
  modelGroups: ModelGroup[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}) {
  const { isMobile } = useSidebar();

  // Find the active model object based on the selectedModel ID
  const activeModel =
    models.find((model) => model.id === selectedModel) || models[0];

  if (!activeModel) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <span className="text-xs font-bold">AI</span>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeModel.name}</span>
                <span className="truncate text-xs">
                  {activeModel.providerName}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Models
            </DropdownMenuLabel>
            {modelGroups.map((group) => (
              <React.Fragment key={group.providerName}>
                <DropdownMenuLabel className="text-xs font-semibold pt-2">
                  {group.providerName}
                </DropdownMenuLabel>
                {group.models.map((model) => (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => onModelChange(model.id)}
                    className="gap-2 p-2"
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border">
                      <span className="text-xs">AI</span>
                    </div>
                    {model.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
