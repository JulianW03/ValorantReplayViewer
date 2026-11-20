import { useState } from 'react';
import { Archive, BugPlay, ChevronDown, Clock, HardDrive, RefreshCw, Settings } from 'lucide-react';
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
import { useUpdateStatus } from '@/lib/queries';

function UpdateDot() {
    return <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Update available" />;
}

const libraryNavItems = [
    { title: 'Saved Matches', path: '/saved', icon: HardDrive },
    { title: 'Auto Archive', path: '/auto-archive', icon: Archive },
];

const valorantNavItems = [
    { title: 'Recent Matches', path: '/recent', icon: Clock },
    { title: 'Injector', path: '/injector', icon: BugPlay },
];

function NavGroup({ label, items }: { label: string; items: typeof libraryNavItems }) {
    const [isOpen, setIsOpen] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <SidebarGroup>
                <SidebarGroupLabel asChild>
                    <CollapsibleTrigger className="flex w-full items-center justify-between">
                        {label}
                        <ChevronDown
                            className={cn(
                                'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                                isOpen && 'rotate-180',
                            )}
                        />
                    </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
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
    );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const [toolsOpen, setToolsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const updateAvailable = useUpdateStatus()?.status === 'UPDATE_AVAILABLE';

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
                <NavGroup label="Library" items={libraryNavItems} />
                <NavGroup label="Valorant" items={valorantNavItems} />

                <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
                    <SidebarGroup>
                        <SidebarGroupLabel asChild>
                            <CollapsibleTrigger className="flex w-full items-center justify-between">
                                <span className="flex items-center gap-2">
                                    Settings
                                    {updateAvailable && !toolsOpen && <UpdateDot />}
                                </span>
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
                                    <SidebarMenuItem>
                                        <SidebarMenuButton
                                            isActive={location.pathname === '/update-check'}
                                            onClick={() => navigate('/update-check')}
                                            tooltip="Update Check"
                                        >
                                            <RefreshCw />
                                            <span className="flex-1">Update Check</span>
                                            {updateAvailable && <UpdateDot />}
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
