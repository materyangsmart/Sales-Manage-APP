import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Database, Globe, Building, User } from "lucide-react";

// DataScope 可视化配置
const DATA_SCOPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; desc: string }> = {
  SELF: {
    label: "仅本人",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    icon: <User className="h-3.5 w-3.5" />,
    desc: "只能查看和操作自己创建的数据",
  },
  DEPT: {
    label: "本部门",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Building className="h-3.5 w-3.5" />,
    desc: "可查看本部门所有成员的数据",
  },
  DEPT_AND_SUB: {
    label: "本部门及下级",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: <Building className="h-3.5 w-3.5" />,
    desc: "可查看本部门及所有下级部门的数据",
  },
  CUSTOM: {
    label: "自定义范围",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    icon: <Database className="h-3.5 w-3.5" />,
    desc: "按自定义规则确定数据访问范围",
  },
  ALL: {
    label: "全公司",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <Globe className="h-3.5 w-3.5" />,
    desc: "可查看全公司所有数据（最高权限）",
  },
};

// DataScope 权限等级可视化条
function DataScopeBar({ scope }: { scope: string }) {
  const levels = ["SELF", "DEPT", "DEPT_AND_SUB", "CUSTOM", "ALL"];
  const idx = levels.indexOf(scope);
  const config = DATA_SCOPE_CONFIG[scope] ?? DATA_SCOPE_CONFIG.SELF;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
          {config.icon}
          {config.label}
        </span>
      </div>
      <div className="flex gap-1">
        {levels.map((l, i) => (
          <div
            key={l}
            className={`h-1.5 flex-1 rounded-full transition-all ${i <= idx ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{config.desc}</p>
    </div>
  );
}

// 权限标签组
const PERMISSION_GROUPS: Record<string, { label: string; perms: string[] }> = {
  order: {
    label: "订单管理",
    perms: ["order:view", "order:create", "order:edit", "order:delete", "order:approve"],
  },
  customer: {
    label: "客户管理",
    perms: ["customer:view", "customer:create", "customer:edit"],
  },
  finance: {
    label: "财务管理",
    perms: ["invoice:view", "payment:view", "payment:apply"],
  },
  user: {
    label: "用户权限",
    perms: ["user:manage", "role:manage"],
  },
  report: {
    label: "报表分析",
    perms: ["report:view", "report:export"],
  },
  system: {
    label: "系统管理",
    perms: ["system:admin", "audit:view"],
  },
};

function PermissionBadge({ perm, active }: { perm: string; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
        active
          ? "bg-primary/10 text-primary border-primary/30"
          : "bg-muted/50 text-muted-foreground border-transparent line-through opacity-40"
      }`}
    >
      {perm}
    </span>
  );
}

export default function AdminRoles() {
  const { data: roles = [], isLoading } = trpc.rbac.getRoles.useQuery();
  const { data: usersData } = trpc.rbac.getUsers.useQuery({ pageSize: 200 });

  // 统计每个角色的用户数
  const roleUserCount = (() => {
    const map: Record<number, number> = {};
    (usersData?.items ?? []).forEach((u: any) => {
      (u.roles ?? []).forEach((r: any) => {
        map[r.id] = (map[r.id] ?? 0) + 1;
      });
    });
    return map;
  })();

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-muted-foreground">加载角色数据中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" /> 角色管理
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          查看系统中所有角色的数据范围（Data Scope）与权限配置。共 {roles.length} 个角色。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(roles as any[]).map((role) => {
          // 解析角色权限（假设 role.permissions 是数组或逗号分隔字符串）
          const permList: string[] = Array.isArray(role.permissions)
            ? role.permissions
            : typeof role.permissions === "string" && role.permissions
            ? role.permissions.split(",").map((p: string) => p.trim())
            : [];

          return (
            <Card key={role.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{role.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{role.code}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>{roleUserCount[role.id] ?? 0} 人</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                {/* 数据范围可视化 */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">数据范围 (Data Scope)</p>
                  <DataScopeBar scope={role.dataScope ?? "SELF"} />
                </div>

                {/* 权限矩阵 */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">权限配置</p>
                  {permList.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">无特定权限配置</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(PERMISSION_GROUPS).map(([key, group]) => {
                        const activePerms = group.perms.filter((p) => permList.includes(p));
                        if (activePerms.length === 0) return null;
                        return (
                          <div key={key}>
                            <p className="text-xs text-muted-foreground mb-1">{group.label}</p>
                            <div className="flex flex-wrap gap-1">
                              {group.perms.map((p) => (
                                <PermissionBadge key={p} perm={p} active={permList.includes(p)} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {/* 未分组的权限 */}
                      {(() => {
                        const allGrouped = Object.values(PERMISSION_GROUPS).flatMap((g) => g.perms);
                        const ungrouped = permList.filter((p) => !allGrouped.includes(p));
                        if (ungrouped.length === 0) return null;
                        return (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">其他</p>
                            <div className="flex flex-wrap gap-1">
                              {ungrouped.map((p) => (
                                <Badge key={p} variant="outline" className="text-xs font-mono">{p}</Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* 角色描述 */}
                {role.description && (
                  <p className="text-xs text-muted-foreground border-t pt-3">{role.description}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
