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
import { format, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import { useEffect, useState } from "react";
import { MeasurementResult } from "@/lib/types";
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

type SortField = "timestamp" | "heartRate";
type SortOrder = "asc" | "desc";
type ViewMode = "list" | "card" | "graph";

export default function HistoryPage() {
  const router = useRouter();
  const { userInfo } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [view, setView] = useState<ViewMode>("list");
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userList, setUserList] = useState<any[]>([]);

  // DB에서 측정 결과 조회
  useEffect(() => {
    async function fetchResults() {
      setLoading(true);
      setError("");
      try {
        // userId를 반드시 쿼리로 포함
        const userId = userInfo?.id;
        if (!userId) {
          setError("로그인이 필요합니다.");
          setLoading(false);
          return;
        }
        const response = await fetch(`/api/history?userId=${userId}`);
        if (!response.ok) {
          let errorMsg = "서버 응답 오류";
          try {
            const errorData = await response.json();
            if (errorData?.error) errorMsg = errorData.error;
          } catch (e) {}
          throw new Error(errorMsg);
        }
        const data = await response.json();
        setResults(data);
      } catch (err: any) {
        setError(err.message || "알 수 없는 오류");
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, [userInfo]);

  // 사용자 목록 조회 (관리자용)
  useEffect(() => {
    const fetchUsers = async () => {
      if (!userInfo?.isAdmin) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(true);

      try {
        const response = await fetch("/api/users");
        if (!response.ok) {
          throw new Error("사용자 목록 조회 오류");
        }

        const users = await response.json();
        setUserList(users);
      } catch (err) {
        console.error("사용자 목록 조회 오류:", err);
      }
    };

    fetchUsers();
  }, [userInfo]);

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
      RMSSD: result.rmssd !== null ? result.rmssd.toFixed(2) : "-",
      SDNN: result.sdnn !== null ? result.sdnn.toFixed(2) : "-",
      LF: result.lf !== null ? result.lf.toFixed(2) : "-",
      HF: result.hf !== null ? result.hf.toFixed(2) : "-",
      "LF/HF": result.lfHfRatio !== null ? result.lfHfRatio.toFixed(2) : "-",
      기분: result.mood ? moodToText(result.mood) : "-",
      사용자: result.user?.name || "-",
      이메일: result.email || result.user?.email || "-",
      소속: result.user?.company || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "측정이력");
    XLSX.writeFile(
      wb,
      `측정이력_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`
    );
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
    const rmssdData = timeOrderedResults.map((r) => r.rmssd);
    const sdnnData = timeOrderedResults.map((r) => r.sdnn);
    const lfhfData = timeOrderedResults.map((r) => r.lfHfRatio);

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
    const lfData = timeOrderedResults.map((r) => r.lf);
    const hfData = timeOrderedResults.map((r) => r.hf);
    const lfhfData = timeOrderedResults.map((r) => r.lfHfRatio);
    const pnn50Data = timeOrderedResults.map((r) => r.pnn50);

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

  // 뷰 전환 핸들러
  const handleViewChange = (newView: ViewMode) => {
    setView(newView);
  };

  // 사용자 선택 핸들러 (관리자용)
  const handleUserSelect = (userId: string | null) => {
    setSelectedUser(userId);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="p-6 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary mb-4" />
          <h1 className="text-2xl font-bold mb-4">측정 기록 불러오는 중...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-4">오류 발생</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push("/measure")}>
            측정 페이지로 이동
          </Button>
        </div>
      </div>
    );
  }

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
          <h1 className="text-xl md:text-3xl font-bold ml-2">측정 기록</h1>
        </div>

        {/* 관리자: 사용자 선택 드롭다운 */}
        {isAdmin && (
          <div className="flex-1 flex justify-center mx-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>
                    {selectedUser
                      ? userList.find((u) => u.id === selectedUser)?.name ||
                        userList.find((u) => u.id === selectedUser)?.email ||
                        "선택된 사용자"
                      : "모든 사용자"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                <DropdownMenuLabel>사용자 선택</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleUserSelect(null)}>
                  모든 사용자
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {userList.map((user) => (
                  <DropdownMenuItem
                    key={user.id}
                    onClick={() => handleUserSelect(user.id)}
                  >
                    {user.name || user.email}
                  </DropdownMenuItem>
                ))}
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
                      {result.rmssd !== null ? result.rmssd.toFixed(2) : "-"}
                    </TableCell>
                    <TableCell>
                      {result.sdnn !== null ? result.sdnn.toFixed(2) : "-"}
                    </TableCell>
                    <TableCell>
                      {result.lfHfRatio !== null
                        ? result.lfHfRatio.toFixed(2)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {result.mood ? moodToText(result.mood) : "-"}
                    </TableCell>
                    <TableCell>{result.user?.name || "-"}</TableCell>
                    <TableCell>
                      {result.email || result.user?.email || "-"}
                    </TableCell>
                    <TableCell>{result.user?.company || "-"}</TableCell>
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
                          <div>{result.user?.name || "-"}</div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">이메일</div>
                          <div>{result.email || result.user?.email || "-"}</div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">소속</div>
                          <div>{result.user?.company || "-"}</div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">RMSSD</div>
                          <div>
                            {result.rmssd !== null
                              ? result.rmssd.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">SDNN</div>
                          <div>
                            {result.sdnn !== null
                              ? result.sdnn.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">LF</div>
                          <div>
                            {result.lf !== null ? result.lf.toFixed(2) : "-"}
                          </div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">HF</div>
                          <div>
                            {result.hf !== null ? result.hf.toFixed(2) : "-"}
                          </div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">LF/HF</div>
                          <div>
                            {result.lfHfRatio !== null
                              ? result.lfHfRatio.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                        <div className="border-b pb-1">
                          <div className="text-muted-foreground">pNN50</div>
                          <div>
                            {result.pnn50 !== null
                              ? result.pnn50.toFixed(2)
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
            <Card key={result.id} className="overflow-hidden">
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
                          {result.user?.name || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">이메일</span>
                        <span className="font-medium truncate ml-2">
                          {result.email || result.user?.email || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">소속</span>
                        <span className="font-medium truncate ml-2">
                          {result.user?.company || "-"}
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
                            {result.rmssd !== null
                              ? result.rmssd.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">SDNN</span>
                          <div className="font-medium">
                            {result.sdnn !== null
                              ? result.sdnn.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">LF/HF</span>
                          <div className="font-medium">
                            {result.lfHfRatio !== null
                              ? result.lfHfRatio.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">pNN50</span>
                          <div className="font-medium">
                            {result.pnn50 !== null
                              ? result.pnn50.toFixed(2)
                              : "-"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
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
