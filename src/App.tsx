import {
  Button,
  Checkbox,
  Container,
  FileInput,
  Group,
  MultiSelect,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMemo, useState } from "react";
import {
  type ColumnMapping,
  type CurrentSalaryData,
  parseCurrentSalaryFile,
  parseMappingFile,
} from "./csvParser";

// Markdown KV形式のテキストを生成
const generatePrompt = (
  year: number,
  month: number,
  overtimeData: ColumnMapping[],
  currentSalaryData: CurrentSalaryData[],
  employeeCode: ColumnMapping,
  fixedOvertimeAllowance: ColumnMapping,
  fixedOvertimeExcess: ColumnMapping
) => {
  const markdownParts: string[] = [];

  // 年月を最上部に追加
  markdownParts.push(`${year}年${month}月\n\n`);

  // currentカラム名からfreeeカラム名へのマッピングを作成
  const currentToFreeeMap = new Map<string, string>();
  overtimeData.forEach((item) => {
    if (item.current.trim() && item.freee.trim()) {
      currentToFreeeMap.set(item.current, item.freee);
    }
  });

  // 固定残業代と固定残業超過もマッピングに追加
  if (
    fixedOvertimeAllowance.current.trim() &&
    fixedOvertimeAllowance.freee.trim()
  ) {
    currentToFreeeMap.set(
      fixedOvertimeAllowance.current,
      fixedOvertimeAllowance.freee
    );
  }
  if (fixedOvertimeExcess.current.trim() && fixedOvertimeExcess.freee.trim()) {
    currentToFreeeMap.set(
      fixedOvertimeExcess.current,
      fixedOvertimeExcess.freee
    );
  }

  const extractColumns = Array.from(
    new Set(
      [
        ...overtimeData.map((item) => item.current),
        fixedOvertimeAllowance.current,
        fixedOvertimeExcess.current,
      ].filter((col) => col.trim() !== "")
    )
  );

  currentSalaryData.forEach((employee) => {
    const employeeCodeValue = employee[employeeCode.current] || "";

    markdownParts.push(`# 従業員番号: ${employeeCodeValue}\n`);

    // マッピングで指定されたカラムを抽出
    extractColumns.forEach((colName) => {
      const value = employee[colName] || "";
      const freeeColName = currentToFreeeMap.get(colName) || colName;
      markdownParts.push(`${freeeColName}: ${value}\n`);
    });

    markdownParts.push("\n");
  });

  return markdownParts.join("");
};

function App() {
  const [year, setYear] = useState<string>("2025");
  const [month, setMonth] = useState<string>("10");
  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const [currentSalaryFile, setCurrentSalaryFile] = useState<File | null>(null);
  const [overtimeData, setOvertimeData] = useState<ColumnMapping[]>([]);
  const [employeeCode, setEmployeeCode] = useState<ColumnMapping>({
    freee: "",
    current: "",
  });
  const [fixedOvertimeAllowance, setFixedOvertimeAllowance] =
    useState<ColumnMapping>({ freee: "", current: "" });
  const [fixedOvertimeExcess, setFixedOvertimeExcess] = useState<ColumnMapping>(
    { freee: "", current: "" }
  );
  const [currentSalaryData, setCurrentSalaryData] = useState<
    CurrentSalaryData[]
  >([]);
  const [currentSalaryColumns, setCurrentSalaryColumns] = useState<string[]>(
    []
  );
  const [filterApplied, setFilterApplied] = useState<boolean>(false);
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(
    new Set()
  );

  // マッピングファイルを処理する関数
  const handleMappingFileSelect = (file: File | null) => {
    if (!file) return;
    setMappingFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseMappingFile(text);

      if (result.success) {
        setOvertimeData(result.data.overtimeData);
        setEmployeeCode(result.data.employeeCode);
        setFixedOvertimeAllowance(result.data.fixedOvertimeAllowance);
        setFixedOvertimeExcess(result.data.fixedOvertimeExcess);
        notifications.show({
          title: "成功",
          message: result.message,
          color: "green",
        });
      } else {
        setMappingFile(null);
        setOvertimeData([]);
        setEmployeeCode({ freee: "", current: "" });
        setFixedOvertimeAllowance({ freee: "", current: "" });
        setFixedOvertimeExcess({ freee: "", current: "" });
        notifications.show({
          title: "エラー",
          message: result.error,
          color: "red",
        });
      }
    };

    reader.readAsText(file);
  };

  // 現行給与ファイルを処理する関数
  const handleCurrentSalaryFileSelect = (file: File | null) => {
    if (!file) return;
    setCurrentSalaryFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseCurrentSalaryFile(text);

      if (result.success) {
        setCurrentSalaryData(result.data.data);
        setCurrentSalaryColumns(result.data.columns);
        notifications.show({
          title: "成功",
          message: result.message,
          color: "green",
        });
      } else {
        setCurrentSalaryFile(null);
        setCurrentSalaryData([]);
        setCurrentSalaryColumns([]);
        notifications.show({
          title: "エラー",
          message: result.error,
          color: "red",
        });
      }
    };

    reader.readAsText(file);
  };

  const handleToggleEmployee = (empCode: string) => {
    setSelectedEmployees((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(empCode)) {
        newSet.delete(empCode);
      } else {
        newSet.add(empCode);
      }
      return newSet;
    });
  };

  const handleToggleAll = () => {
    if (selectedEmployees.size === filteredCurrentSalaryData.length) {
      setSelectedEmployees(new Set());
    } else {
      const allEmployeeCodes = filteredCurrentSalaryData.map(
        (row) => row[employeeCode.current] || ""
      );
      setSelectedEmployees(new Set(allEmployeeCodes));
    }
  };

  const availableFilterValues = useMemo(() => {
    if (!filterColumn || currentSalaryData.length === 0) {
      return [];
    }
    return Array.from(
      new Set(
        currentSalaryData
          .map((row) => row[filterColumn])
          .filter((value) => value && value.trim() !== "")
      )
    ).sort();
  }, [filterColumn, currentSalaryData]);

  const filteredCurrentSalaryData = useMemo(() => {
    if (!filterApplied || !filterColumn || filterValues.length === 0) {
      return currentSalaryData;
    }
    return currentSalaryData.filter((row) =>
      filterValues.includes(row[filterColumn])
    );
  }, [filterApplied, filterColumn, filterValues, currentSalaryData]);

  const selectedCurrentSalaryData = useMemo(() => {
    if (selectedEmployees.size === 0) {
      return filteredCurrentSalaryData;
    }
    return filteredCurrentSalaryData.filter((row) => {
      const empCode = row[employeeCode.current] || "";
      return selectedEmployees.has(empCode);
    });
  }, [filteredCurrentSalaryData, selectedEmployees, employeeCode]);

  const generatedPrompt = useMemo(() => {
    if (overtimeData.length === 0 || selectedCurrentSalaryData.length === 0) {
      return "";
    }
    return generatePrompt(
      parseInt(year),
      parseInt(month),
      overtimeData,
      selectedCurrentSalaryData,
      employeeCode,
      fixedOvertimeAllowance,
      fixedOvertimeExcess
    );
  }, [
    year,
    month,
    overtimeData,
    selectedCurrentSalaryData,
    employeeCode,
    fixedOvertimeAllowance,
    fixedOvertimeExcess,
  ]);

  console.log(fixedOvertimeAllowance, fixedOvertimeExcess);

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Title order={1}>Indeedee Prompt</Title>

        <Stack gap="md">
          <Title order={2}>年月</Title>
          <Group>
            <Select
              label="年"
              data={Array.from({ length: 10 }, (_, i) => {
                const y = 2020 + i;
                return { value: String(y), label: `${y}年` };
              })}
              value={year}
              onChange={(value) => setYear(value || "2025")}
              style={{ width: "150px" }}
            />
            <Select
              label="月"
              data={Array.from({ length: 12 }, (_, i) => {
                const m = i + 1;
                return { value: String(m), label: `${m}月` };
              })}
              value={month}
              onChange={(value) => setMonth(value || "10")}
              style={{ width: "150px" }}
            />
          </Group>
        </Stack>

        <Stack gap="md">
          <Title order={2}>マッピング</Title>
          <Text c="dimmed">
            「P2.マッピング」のシートをcsvでダウンロードしたものを読み込ませてください。割増賃金のマッピングを自動で読み込みます。
          </Text>
          <FileInput
            accept="text/csv"
            placeholder="CSVファイルを選択"
            value={mappingFile}
            onChange={handleMappingFileSelect}
          />
          {overtimeData.length > 0 && (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>freee</Table.Th>
                  <Table.Th>現行給与</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {employeeCode.current && (
                  <Table.Tr>
                    <Table.Td>{employeeCode.freee}</Table.Td>
                    <Table.Td>{employeeCode.current}</Table.Td>
                  </Table.Tr>
                )}
                {overtimeData.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>{item.freee}</Table.Td>
                    <Table.Td>{item.current}</Table.Td>
                  </Table.Tr>
                ))}
                {fixedOvertimeAllowance.current && (
                  <Table.Tr>
                    <Table.Td>{fixedOvertimeAllowance.freee}</Table.Td>
                    <Table.Td>{fixedOvertimeAllowance.current}</Table.Td>
                  </Table.Tr>
                )}
                {fixedOvertimeExcess.current && (
                  <Table.Tr>
                    <Table.Td>{fixedOvertimeExcess.freee}</Table.Td>
                    <Table.Td>{fixedOvertimeExcess.current}</Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          )}
        </Stack>

        <Stack gap="md">
          <Title order={2}>現行給与</Title>
          <Text c="dimmed">
            「②現行給与」のシートをcsvでダウンロードしたものを読み込ませてください。
          </Text>
          <FileInput
            accept="text/csv"
            placeholder="CSVファイルを選択"
            value={currentSalaryFile}
            onChange={handleCurrentSalaryFileSelect}
          />
          {currentSalaryData.length > 0 && (
            <>
              <Checkbox
                label="フィルターを適用（一種類の勤務賃金設定に絞ってください）"
                checked={filterApplied}
                onChange={(event) =>
                  setFilterApplied(event.currentTarget.checked)
                }
              />
              {filterApplied && (
                <Group>
                  <Select
                    placeholder="カラムを選択"
                    data={currentSalaryColumns}
                    value={filterColumn}
                    onChange={(value) => {
                      setFilterColumn(value);
                      setFilterValues([]); // カラム変更時にフィルター値をリセット
                    }}
                    style={{ flex: 1 }}
                  />
                  <MultiSelect
                    placeholder="値を選択"
                    data={availableFilterValues}
                    value={filterValues}
                    onChange={setFilterValues}
                    style={{ flex: 2 }}
                  />
                </Group>
              )}
              <Table
                striped
                highlightOnHover
                withTableBorder
                withColumnBorders
                horizontalSpacing="md"
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: "60px" }}>
                      <Checkbox
                        checked={
                          filteredCurrentSalaryData.length > 0 &&
                          selectedEmployees.size ===
                            filteredCurrentSalaryData.length
                        }
                        indeterminate={
                          selectedEmployees.size > 0 &&
                          selectedEmployees.size <
                            filteredCurrentSalaryData.length
                        }
                        onChange={handleToggleAll}
                      />
                    </Table.Th>
                    {currentSalaryColumns.map((col) => (
                      <Table.Th key={col} style={{ minWidth: "150px" }}>
                        {col}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredCurrentSalaryData.map((item, index) => {
                    const empCode = item[employeeCode.current] || "";
                    return (
                      <Table.Tr key={index}>
                        <Table.Td>
                          <Checkbox
                            checked={selectedEmployees.has(empCode)}
                            onChange={() => handleToggleEmployee(empCode)}
                          />
                        </Table.Td>
                        {currentSalaryColumns.map((col) => (
                          <Table.Td key={col} style={{ minWidth: "150px" }}>
                            {item[col] || ""}
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </>
          )}
        </Stack>

        <Stack gap="md">
          <Title order={2}>プロンプト</Title>
          {generatedPrompt && (
            <>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(generatedPrompt);
                  notifications.show({
                    title: "成功",
                    message: "クリップボードにコピーしました",
                    color: "green",
                  });
                }}
              >
                クリップボードにコピー
              </Button>
              <Textarea value={generatedPrompt} rows={20} readOnly />
            </>
          )}
        </Stack>
      </Stack>
    </Container>
  );
}

export default App;
