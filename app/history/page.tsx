"use client";

import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useState, useEffect } from "react";
import {
  Heart,
  Calendar,
  ArrowLeft,
  ChevronDown,
  ArrowUpDown,
  Loader2,
  AlertTriangle,
  Plus,
  LineChart as LineChartIcon,
  BarChart as BarChartIcon,
  Users,
  Eye,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  BarChart,
  defaultLineChartOptions,
  defaultBarChartOptions,
} from "@/components/ui/chart";
import * as XLSX from "xlsx";
import { useMeasurementHistory, useUsers } from "@/hooks/use-queries";
import { useQueryClient } from "@tanstack/react-query";

type SortField = "timestamp" | "heartRate";

interface MeasurementResult {
  id: string;
  timestamp: string;
  heartRate: number;
  confidence?: number;
  hrv?: {
    rmssd?: number;
    sdnn?: number;
    lf?: number;
    hf?: number;
    lfHfRatio?: number;
    pnn50?: number;
  };
  mood?: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
    company?: string;
  };
  email?: string;
  caricatureUrl?: string;
  rmssd?: number;
  sdnn?: number;
  lf?: number;
  hf?: number;
  lfHfRatio?: number;
  pnn50?: number;
}
type SortOrder = "asc" | "desc";
type ViewMode = "list" | "card" | "graph";

export default function HistoryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userInfo, setCurrentResult } = useAppStore();
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [view, setView] = useState<ViewMode>("list");
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [showAllUsers, setShowAllUsers] = useState(false); // 모든 사용자 데이터 표시 여부

  // 관리자 여부 확인
  useEffect(() => {
    const admin = !!userInfo?.isAdmin;
    setIsAdmin(admin);
    // 관리자인 경우 기본적으로 모든 사용자 데이터 표시
    if (admin) {
      setShowAllUsers(true);
    }
  }, [userInfo]);

  // 사용자 목록 조회 (관리자용) - TanStack Query 사용
  const {
    data: userList = [],
    isLoading: isLoadingUsers,
    error: usersError,
  } = useUsers(undefined, {
    queryKey: ["users", undefined],
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000, // 5분 동안 캐시 유지
  });

  // 결과 조회 (관리자는 선택적으로 특정 사용자 혹은 전체 사용자 데이터를 볼 수 있음)
  const userId = userInfo?.id;
  // 관리자인 경우: 특정 사용자를 선택했거나 모든 사용자 데이터를 표시하는 경우
  // 일반 사용자인 경우: 자신의 데이터만 표시
  const queryUserId = isAdmin
    ? showAllUsers
      ? undefined
      : selectedUser || undefined
    : userId;

  const {
    data: results = [],
    isLoading,
    error,
  } = useMeasurementHistory(queryUserId, {
    queryKey: ["measurementHistory", queryUserId], // Add queryKey to match the required type
    enabled: isAdmin || !!userId, // 관리자이거나 로그인한 사용자가 있는 경우에만 실행
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000, // 1분 동안 캐시 유지
  });

  // API 응답 구조 확인을 위한 디버깅
  useEffect(() => {
    if (results && results.length > 0) {
      console.log("API 응답 데이터 구조:", results[0]);
      console.log("첫 번째 결과 HRV 데이터:", results[0].hrv);
    }
  }, [results]);

  // 정렬 함수
  const sortedResults = [...results].sort((a, b) => {
    if (sortField === "timestamp") {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return sortOrder === "asc"
        ? dateA.getTime() - dateB.getTime()
        : dateB.getTime() - dateA.getTime();
    } else if (sortField === "heartRate") {
      return sortOrder === "asc"
        ? a.heartRate - b.heartRate
        : b.heartRate - a.heartRate;
    }
    return 0;
  });

  // 정렬 변경 핸들러
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 같은 필드를 클릭한 경우 정렬 순서만 변경
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // 다른 필드를 클릭한 경우 필드 변경 및 내림차순 기본
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // 결과 상세 보기 핸들러
  const handleViewDetail = (result: any) => {
    // 클릭한 결과를 현재 결과로 설정
    setCurrentResult({
      id: result.id,
      timestamp: result.timestamp,
      heartRate: result.heartRate,
      confidence: result.confidence || 0,
      hrv: {
        rmssd: result.rmssd ?? null,
        sdnn: result.sdnn ?? null,
        lf: result.lf ?? null,
        hf: result.hf ?? null,
        lfHfRatio: result.lfHfRatio ?? null,
        pnn50: result.pnn50 ?? null,
      },
      userInfo: {
        id: result.userId || result.user?.id,
        company: result.user?.company || "",
        email: result.email || result.user?.email,
        name: result.user?.name,
      },
      mood: result.mood,
      caricatureUrl: result.caricatureUrl,
    });

    // 결과 페이지로 이동
    router.push("/results");
  };

  // 엑셀로 내보내기 함수 (관리자만)
  const exportToExcel = () => {
    // 테이블에 표시되는 데이터만 추출
    const exportData = sortedResults.map((result) => ({
      측정일시: format(new Date(result.timestamp), "yyyy-MM-dd HH:mm", {
        locale: ko,
      }),
      "심박수(BPM)": result.heartRate?.toFixed(1) ?? "-",
      "신뢰도(%)":
        result.confidence !== undefined
          ? (result.confidence * 100).toFixed(0)
          : "-",
      RMSSD:
        result.hrv?.rmssd !== null && result.hrv?.rmssd !== undefined
          ? result.hrv.rmssd.toFixed(2)
          : "-",
      SDNN:
        result.hrv?.sdnn !== null && result.hrv?.sdnn !== undefined
          ? result.hrv.sdnn.toFixed(2)
          : "-",
      LF:
        result.hrv?.lf !== null && result.hrv?.lf !== undefined
          ? result.hrv.lf.toFixed(2)
          : "-",
      HF:
        result.hrv?.hf !== null && result.hrv?.hf !== undefined
          ? result.hrv.hf.toFixed(2)
          : "-",
      "LF/HF":
        result.hrv?.lfHfRatio !== null && result.hrv?.lfHfRatio !== undefined
          ? result.hrv.lfHfRatio.toFixed(2)
          : "-",
      pNN50:
        result.hrv?.pnn50 !== null && result.hrv?.pnn50 !== undefined
          ? result.hrv.pnn50.toFixed(2)
          : "-",
      기분: result.mood ? moodToText(result.mood) : "-",
      사용자: result.userInfo?.name || "-",
      이메일: result.userInfo?.email || "-",
      소속: result.userInfo?.company || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "측정이력");
    XLSX.writeFile(
      wb,
      `측정이력_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`
    );
  };

  // 뷰 전환 핸들러
  const handleViewChange = (newView: ViewMode) => {
    setView(newView);
  };

  // 사용자 선택 핸들러 (관리자용)
  const handleUserSelect = (userId: string | null) => {
    if (userId === null) {
      // 모든 사용자 선택 시
      setSelectedUser(null);
      setShowAllUsers(true);
    } else {
      // 특정 사용자 선택 시
      setSelectedUser(userId);
      setShowAllUsers(false);
    }
  };

  // 그래프 데이터 준비
  const prepareChartData = () => {
    if (!results.length) return null;

    // 시간순 정렬 (오래된 순)
    const timeOrderedResults = [...results].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // 날짜 라벨 생성
    const labels = timeOrderedResults.map((result) =>
      format(new Date(result.timestamp), "MM/dd HH:mm")
    );

    // 심박수, RMSSD, SDNN 데이터
    const heartRateData = timeOrderedResults.map((r) => r.heartRate);
    const rmssdData = timeOrderedResults.map((r) => r.hrv?.rmssd ?? null);
    const sdnnData = timeOrderedResults.map((r) => r.hrv?.sdnn ?? null);

    return {
      labels,
      datasets: [
        {
          label: "심박수 (BPM)",
          data: heartRateData,
          borderColor: "rgb(255, 99, 132)",
          backgroundColor: "rgba(255, 99, 132, 0.5)",
          yAxisID: "y",
        },
        {
          label: "RMSSD (ms)",
          data: rmssdData,
          borderColor: "rgb(53, 162, 235)",
          backgroundColor: "rgba(53, 162, 235, 0.5)",
          yAxisID: "y1",
        },
        {
          label: "SDNN (ms)",
          data: sdnnData,
          borderColor: "rgb(75, 192, 192)",
          backgroundColor: "rgba(75, 192, 192, 0.5)",
          yAxisID: "y1",
        },
      ],
    };
  };

  // HRV 지표 그래프 데이터
  const prepareHrvChartData = () => {
    if (!results.length) return null;

    // 시간순 정렬 (오래된 순)
    const timeOrderedResults = [...results].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // 날짜 라벨 생성
    const labels = timeOrderedResults.map((result) =>
      format(new Date(result.timestamp), "MM/dd HH:mm")
    );

    // LF/HF 비율 데이터
    const lfData = timeOrderedResults.map((r) => r.hrv?.lf ?? null);
    const hfData = timeOrderedResults.map((r) => r.hrv?.hf ?? null);
    const lfhfData = timeOrderedResults.map((r) => r.hrv?.lfHfRatio ?? null);
    const pnn50Data = timeOrderedResults.map((r) => r.hrv?.pnn50 ?? null);

    return {
      labels,
      datasets: [
        {
          label: "LF/HF 비율",
          data: lfhfData,
          borderColor: "rgb(153, 102, 255)",
          backgroundColor: "rgba(153, 102, 255, 0.5)",
        },
        {
          label: "LF (ms²)",
          data: lfData,
          borderColor: "rgb(255, 159, 64)",
          backgroundColor: "rgba(255, 159, 64, 0.5)",
          hidden: true,
        },
        {
          label: "HF (ms²)",
          data: hfData,
          borderColor: "rgb(201, 203, 207)",
          backgroundColor: "rgba(201, 203, 207, 0.5)",
          hidden: true,
        },
        {
          label: "pNN50 (%)",
          data: pnn50Data,
          borderColor: "rgb(255, 205, 86)",
          backgroundColor: "rgba(255, 205, 86, 0.5)",
          hidden: true,
        },
      ],
    };
  };

  // 그래프 옵션
  const chartOptions = {
    ...defaultLineChartOptions,
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        type: "linear" as const,
        position: "left" as const,
        title: {
          display: true,
          text: "심박수 (BPM)",
        },
      },
      y1: {
        type: "linear" as const,
        position: "right" as const,
        grid: {
          drawOnChartArea: false,
        },
        title: {
          display: true,
          text: "변이도 (ms)",
        },
      },
    },
  };

  const hrvChartOptions = {
    ...defaultLineChartOptions,
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "값",
        },
      },
    },
  };

  // 로딩 상태 처리
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="p-6 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary mb-4" />
          <h1 className="text-2xl font-bold mb-4">측정 기록 불러오는 중...</h1>
        </div>
      </div>
    );
  }

  // 에러 상태 처리
  if (error || !userInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-4">오류 발생</h1>
          <p className="text-muted-foreground mb-6">
            {error instanceof Error ? error.message : "로그인이 필요합니다."}
          </p>
          <Button onClick={() => router.push("/measure")}>
            측정 페이지로 이동
          </Button>
        </div>
      </div>
    );
  }

  // 결과가 없는 경우
  if (!results || results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="p-6 text-center">
          <Heart className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-4">저장된 이력이 없습니다</h1>
          <p className="text-muted-foreground mb-6">
            심박수를 측정하고 결과를 저장해보세요
          </p>
          <Button
            onClick={() => router.push("/measure")}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>측정하러 가기</span>
          </Button>
        </div>
      </div>
    );
  }

  const chartData = prepareChartData();
  const hrvChartData = prepareHrvChartData();

  return (
    <div className="container">
      {/* 헤더 및 뒤로가기 버튼 */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-y-4">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-1 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden md:inline">이전으로</span>
          </Button>
          <h1 className="text-xl md:text-3xl font-bold ml-2">
            {isAdmin
              ? showAllUsers
                ? "전체 사용자 측정 기록"
                : selectedUser
                ? `사용자 측정 기록: ${
                    userList.find((u) => u.id === selectedUser)?.name ||
                    "선택된 사용자"
                  }`
                : "측정 기록"
              : "내 측정 기록"}
          </h1>
        </div>

        {/* 관리자: 사용자 필터링 컨트롤 */}
        {isAdmin && (
          <div className="flex-1 flex justify-center mx-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>
                    {showAllUsers
                      ? "모든 사용자"
                      : selectedUser
                      ? userList.find((u) => u.id === selectedUser)?.name ||
                        userList.find((u) => u.id === selectedUser)?.email ||
                        "선택된 사용자"
                      : "사용자 선택"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                <DropdownMenuLabel>사용자 필터링</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleUserSelect(null)}
                  className={
                    showAllUsers ? "bg-accent text-accent-foreground" : ""
                  }
                >
                  모든 사용자
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {userList.map((user) => (
                  <DropdownMenuItem
                    key={user.id}
                    onClick={() => handleUserSelect(user.id)}
                    className={
                      selectedUser === user.id
                        ? "bg-accent text-accent-foreground"
                        : ""
                    }
                  >
                    {user.name || user.email || `사용자 ID: ${user.id}`}
                  </DropdownMenuItem>
                ))}
                {isLoadingUsers && (
                  <DropdownMenuItem disabled>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    사용자 목록 로딩 중...
                  </DropdownMenuItem>
                )}
                {userList.length === 0 && !isLoadingUsers && (
                  <DropdownMenuItem disabled>
                    사용자가 없습니다
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* 뷰 전환 버튼 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 md:h-10 flex items-center gap-1"
              >
                {view === "list" && <span>목록</span>}
                {view === "card" && <span>카드</span>}
                {view === "graph" && <span>그래프</span>}
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>보기 방식</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleViewChange("list")}>
                목록 보기
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleViewChange("card")}>
                카드 보기
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleViewChange("graph")}>
                그래프 보기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 정렬 드롭다운 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 md:h-10 flex items-center gap-1"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">정렬</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>정렬 기준</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleSort("timestamp")}>
                날짜{" "}
                {sortField === "timestamp" && (sortOrder === "asc" ? "↑" : "↓")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort("heartRate")}>
                심박수{" "}
                {sortField === "heartRate" && (sortOrder === "asc" ? "↑" : "↓")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 엑셀 다운로드 버튼 (관리자만 노출) */}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 md:h-10 flex items-center gap-1"
              onClick={exportToExcel}
            >
              <span>엑셀 다운로드</span>
            </Button>
          )}

          {/* 측정 버튼 */}
          <Button
            size="sm"
            className="h-8 md:h-10 flex items-center gap-1"
            onClick={() => router.push("/measure")}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">새 측정</span>
          </Button>
        </div>
      </div>

      {view === "graph" && (
        <div className="space-y-6">
          {/* 심박수 및 기본 HRV 지표 그래프 */}
          <Card>
            <CardHeader>
              <CardTitle>시간에 따른 심박수 및 HRV 지표 변화</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-80">
                {chartData && (
                  <LineChart data={chartData} options={chartOptions} />
                )}
              </div>
            </CardContent>
          </Card>

          {/* HRV 세부 지표 그래프 */}
          <Card>
            <CardHeader>
              <CardTitle>시간에 따른 LF/HF 비율 및 기타 지표 변화</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-80">
                {hrvChartData && (
                  <LineChart data={hrvChartData} options={hrvChartOptions} />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {view === "list" && (
        // 목록 뷰 (테이블)
        <div className="bg-card rounded-lg border overflow-hidden">
          {/* 데스크탑 테이블 뷰 - 모바일에서 숨김 */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort("timestamp")}
                  >
                    <div className="flex items-center">
                      측정일시
                      {sortField === "timestamp" && (
                        <ChevronDown
                          className={`ml-1 h-4 w-4 ${
                            sortOrder === "asc" ? "rotate-180 transform" : ""
                          }`}
                        />
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort("heartRate")}
                  >
                    <div className="flex items-center">
                      심박수
                      {sortField === "heartRate" && (
                        <ChevronDown
                          className={`ml-1 h-4 w-4 ${
                            sortOrder === "asc" ? "rotate-180 transform" : ""
                          }`}
                        />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>신뢰도</TableHead>
                  <TableHead>RMSSD</TableHead>
                  <TableHead>SDNN</TableHead>
                  <TableHead>LF/HF</TableHead>
                  <TableHead>기분</TableHead>
                  <TableHead>사용자</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>소속</TableHead>
                  <TableHead>상세</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedResults.map((result) => (
                  <TableRow key={result.id} className="hover:bg-muted/50">
                    <TableCell>
                      {format(new Date(result.timestamp), "yyyy-MM-dd HH:mm", {
                        locale: ko,
                      })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {result.heartRate?.toFixed(1) ?? "-"} BPM
                    </TableCell>
                    <TableCell>
                      {result.confidence !== undefined
                        ? (result.confidence * 100).toFixed(0) + "%"
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {getHrvValue(result, "rmssd") !== null
                        ? getHrvValue(result, "rmssd")?.toFixed(2)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {getHrvValue(result, "sdnn") !== null
                        ? getHrvValue(result, "sdnn")?.toFixed(2)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {getHrvValue(result, "lfHfRatio") !== null
                        ? getHrvValue(result, "lfHfRatio")?.toFixed(2)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {result.mood ? moodToText(result.mood) : "-"}
                    </TableCell>
                    <TableCell>{getUserValue(result, "name")}</TableCell>
                    <TableCell>{getUserValue(result, "email")}</TableCell>
                    <TableCell>{getUserValue(result, "company")}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetail(result)}
                        className="px-2"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* 모바일 아코디언 뷰 - 데스크탑에서 숨김 */}
          <div className="md:hidden">
            <Accordion type="single" collapsible className="w-full">
              {sortedResults.map((result, index) => (
                <AccordionItem key={result.id} value={`item-${index}`}>
                  <AccordionTrigger className="px-4">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-primary/10 p-1.5 rounded-full">
                          <Heart className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {result.heartRate?.toFixed(1) ?? "-"} BPM
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(
                              new Date(result.timestamp),
                              "yyyy-MM-dd HH:mm",
                              {
                                locale: ko,
                              }
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                        {result.confidence !== undefined
                          ? (result.confidence * 100).toFixed(0) + "%"
                          : "-"}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="px-4 pb-4 space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">사용자</div>
                          <div>{getUserValue(result, "name")}</div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">이메일</div>
                          <div>{getUserValue(result, "email")}</div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">소속</div>
                          <div>{getUserValue(result, "company")}</div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">RMSSD</div>
                          <div>
                            {getHrvValue(result, "rmssd") !== null
                              ? getHrvValue(result, "rmssd")?.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">SDNN</div>
                          <div>
                            {getHrvValue(result, "sdnn") !== null
                              ? getHrvValue(result, "sdnn")?.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">LF</div>
                          <div>
                            {getHrvValue(result, "lf") !== null
                              ? getHrvValue(result, "lf")?.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">HF</div>
                          <div>
                            {getHrvValue(result, "hf") !== null
                              ? getHrvValue(result, "hf")?.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">LF/HF</div>
                          <div>
                            {getHrvValue(result, "lfHfRatio") !== null
                              ? getHrvValue(result, "lfHfRatio")?.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">pNN50</div>
                          <div>
                            {getHrvValue(result, "pnn50") !== null
                              ? getHrvValue(result, "pnn50")?.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                        <div className="border-b pb-1 col-span-2">
                          <div className="text-muted-foreground">기분 상태</div>
                          <div>
                            {result.mood ? moodToText(result.mood) : "-"}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-center">
                        <Button
                          size="sm"
                          onClick={() => handleViewDetail(result)}
                          className="w-full"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          상세 결과 보기
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      )}

      {view === "card" && (
        // 카드 뷰
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedResults.map((result) => (
            <Card
              key={result.id}
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleViewDetail(result)}
            >
              <CardHeader className="p-4 pb-2 flex flex-row items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-full">
                  <Heart className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    {result.heartRate?.toFixed(1) ?? "-"} BPM
                  </CardTitle>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {format(new Date(result.timestamp), "yyyy-MM-dd HH:mm", {
                        locale: ko,
                      })}
                    </span>
                  </div>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                        {result.confidence !== undefined
                          ? (result.confidence * 100).toFixed(0) + "%"
                          : "-"}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>측정 신뢰도</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Tabs defaultValue="user" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="user" className="text-xs">
                      사용자
                    </TabsTrigger>
                    <TabsTrigger value="hrv" className="text-xs">
                      HRV
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="user" className="pt-2 pb-0">
                    <div className="text-sm space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">사용자</span>
                        <span className="font-medium truncate ml-2">
                          {getUserValue(result, "name")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">이메일</span>
                        <span className="font-medium truncate ml-2">
                          {getUserValue(result, "email")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">소속</span>
                        <span className="font-medium truncate ml-2">
                          {getUserValue(result, "company")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">기분</span>
                        <span className="font-medium truncate ml-2">
                          {result.mood ? moodToText(result.mood) : "-"}
                        </span>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="hrv" className="pt-2 pb-0">
                    <div className="text-sm space-y-1.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground">RMSSD</span>
                          <div className="font-medium">
                            {getHrvValue(result, "rmssd") !== null
                              ? getHrvValue(result, "rmssd")?.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">SDNN</span>
                          <div className="font-medium">
                            {getHrvValue(result, "sdnn") !== null
                              ? getHrvValue(result, "sdnn")?.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">LF/HF</span>
                          <div className="font-medium">
                            {getHrvValue(result, "lfHfRatio") !== null
                              ? getHrvValue(result, "lfHfRatio")?.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">pNN50</span>
                          <div className="font-medium">
                            {getHrvValue(result, "pnn50") !== null
                              ? getHrvValue(result, "pnn50")?.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex items-center justify-center mt-2 pt-2 border-t">
                  <Button size="sm" variant="ghost" className="w-full">
                    <Eye className="h-4 w-4 mr-2" />
                    상세 결과 보기
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 text-center text-sm text-muted-foreground">
        총 {results.length}개의 측정 결과가 있습니다
      </div>
    </div>
  );
}

// HRV 값을 안전하게 추출하는 헬퍼 함수
function getHrvValue(result: any, key: string): number | null {
  // 1. hrv 객체 내부에서 확인
  if (result.hrv && result.hrv[key] !== undefined && result.hrv[key] !== null) {
    return result.hrv[key];
  }
  
  // 2. 루트 레벨에서 확인
  if (result[key] !== undefined && result[key] !== null) {
    return result[key];
  }
  
  // 3. 값을 찾을 수 없는 경우
  return null;
}

// 사용자 정보를 안전하게 추출하는 헬퍼 함수
function getUserValue(result: any, key: string): string {
  // 1. userInfo 객체에서 확인 (표준 형식)
  if (result.userInfo && result.userInfo[key] !== undefined && result.userInfo[key] !== null) {
    return result.userInfo[key];
  }
  
  // 2. user 객체에서 확인 (API 응답 형식)
  if (result.user && result.user[key] !== undefined && result.user[key] !== null) {
    return result.user[key];
  }
  
  // 3. 특수 케이스: email은 루트 레벨에서도 확인
  if (key === 'email' && result.email !== undefined && result.email !== null) {
    return result.email;
  }
  
  // 4. 값을 찾을 수 없는 경우
  return '-';
}

// 기분 상태 텍스트로 변환
function moodToText(mood: string): string {
  switch (mood) {
    case "happy":
      return "행복함";
    case "sad":
      return "우울함";
    case "stressed":
      return "스트레스";
    case "relaxed":
      return "편안함";
    case "neutral":
      return "보통";
    default:
      return mood;
  }
}
