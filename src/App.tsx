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
  type CurrentSalaryData,
  type OvertimeData,
  parseCurrentSalaryFile,
  parseMappingFile,
} from "./csvParser";

// Markdown KV形式のテキストを生成
const generatePrompt = (
  year: number,
  month: number,
  overtimeData: OvertimeData[],
  currentSalaryData: CurrentSalaryData[]
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

  const extractColumns = Array.from(
    new Set(
      overtimeData
        .map((item) => item.current)
        .filter((col) => col.trim() !== "")
    )
  );

  currentSalaryData.forEach((employee) => {
    const employeeCode = employee["従業員コード"] || "";

    markdownParts.push(`# 従業員番号: ${employeeCode}\n`);

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
  const [overtimeData, setOvertimeData] = useState<OvertimeData[]>([]);
  const [currentSalaryData, setCurrentSalaryData] = useState<
    CurrentSalaryData[]
  >([]);
  const [currentSalaryColumns, setCurrentSalaryColumns] = useState<string[]>(
    []
  );
  const [filterApplied, setFilterApplied] = useState<boolean>(false);
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<string[]>([]);

  // マッピングファイルを処理する関数
  const handleMappingFileSelect = (file: File | null) => {
    if (!file) return;
    setMappingFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseMappingFile(text);

      if (result.success) {
        setOvertimeData(result.data);
        notifications.show({
          title: "成功",
          message: result.message,
          color: "green",
        });
      } else {
        setMappingFile(null);
        setOvertimeData([]);
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

  const generatedPrompt = useMemo(() => {
    if (overtimeData.length === 0 || filteredCurrentSalaryData.length === 0) {
      return "";
    }
    return generatePrompt(
      parseInt(year),
      parseInt(month),
      overtimeData,
      filteredCurrentSalaryData
    );
  }, [year, month, overtimeData, filteredCurrentSalaryData]);

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
                {overtimeData.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>{item.freee}</Table.Td>
                    <Table.Td>{item.current}</Table.Td>
                  </Table.Tr>
                ))}
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
                    {currentSalaryColumns.map((col) => (
                      <Table.Th key={col} style={{ minWidth: "150px" }}>
                        {col}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredCurrentSalaryData.map((item, index) => (
                    <Table.Tr key={index}>
                      {currentSalaryColumns.map((col) => (
                        <Table.Td key={col} style={{ minWidth: "150px" }}>
                          {item[col] || ""}
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
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
