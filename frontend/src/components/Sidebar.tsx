import { useState } from 'react';
import { BugPlay, ChevronDown, Clock, HardDrive, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { GameStatusPanel } from '@/components/GameStatusPanel';
import { cn } from '@/lib/utils';
import { ShutdownButton } from '@/components/ShutdownButton';
import { Separator } from '@/components/ui/separator.tsx';
import { SimpleLogo } from '@/components/icons/SimpleLogo';

const replayNavItems = [
    { title: 'Saved Matches', path: '/saved', icon: HardDrive },
    { title: 'Recent Matches', path: '/recent', icon: Clock },
    { title: 'Injector', path: '/injector', icon: BugPlay },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const [replayOpen, setReplayOpen] = useState(true);
    const [toolsOpen, setToolsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <Sidebar variant="inset" {...props}>
            <SidebarHeader>
                <div className="flex items-center gap-2.5 px-2 py-1.5">
                    <SimpleLogo className="size-8 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold leading-none">VRV</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Valorant Replay Viewer</p>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <Collapsible open={replayOpen} onOpenChange={setReplayOpen}>
                    <SidebarGroup>
                        <SidebarGroupLabel asChild>
                            <CollapsibleTrigger className="flex w-full items-center justify-between">
                                Replay Management
                                <ChevronDown
                                    className={cn(
                                        'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                                        replayOpen && 'rotate-180',
                                    )}
                                />
                            </CollapsibleTrigger>
                        </SidebarGroupLabel>
                        <CollapsibleContent>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {replayNavItems.map((item) => (
                                        <SidebarMenuItem key={item.path}>
                                            <SidebarMenuButton
                                                isActive={location.pathname === item.path}
                                                onClick={() => navigate(item.path)}
                                                tooltip={item.title}
                                            >
                                                <item.icon />
                                                <span>{item.title}</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </CollapsibleContent>
                    </SidebarGroup>
                </Collapsible>

                <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
                    <SidebarGroup>
                        <SidebarGroupLabel asChild>
                            <CollapsibleTrigger className="flex w-full items-center justify-between">
                                Settings
                                <ChevronDown
                                    className={cn(
                                        'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                                        toolsOpen && 'rotate-180',
                                    )}
                                />
                            </CollapsibleTrigger>
                        </SidebarGroupLabel>
                        <CollapsibleContent>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton
                                            isActive={location.pathname === '/config'}
                                            onClick={() => navigate('/config')}
                                            tooltip="Configuration"
                                        >
                                            <Settings />
                                            <span>Configuration</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </CollapsibleContent>

                    </SidebarGroup>
                </Collapsible>
            </SidebarContent>
            <SidebarRail />
            <SidebarFooter>
                <GameStatusPanel />
                <Separator/>
                <div className="flex items-center justify-between">
                    <ConnectionStatus />
                    <ShutdownButton />
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}
