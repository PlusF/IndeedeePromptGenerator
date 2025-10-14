import type { Column, Row } from "@c-fo/table";
import { Table } from "@c-fo/table";
import {
  Button,
  CheckBox,
  ContentsBase,
  FileUploader,
  FloatingMessageBlock,
  HStack,
  MultiComboBox,
  PageTitle,
  SectionTitle,
  SingleComboBox,
  Text,
  TextArea,
  VStack,
} from "@c-fo/vibes";
import { useMemo, useState } from "react";

type OvertimeData = {
  freee: string;
  current: string;
};

type CurrentSalaryData = {
  [key: string]: string;
};

// Markdown KV形式のテキストを生成
const generatePrompt = (
  overtimeData: OvertimeData[],
  currentSalaryData: CurrentSalaryData[]
) => {
  const markdownParts: string[] = [];

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

    markdownParts.push(`## 従業員番号: ${employeeCode}\n`);

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
  const [showCopiedMessage, setShowCopiedMessage] = useState<boolean>(false);

  // マッピングファイルを処理する関数
  const handleMappingFileSelect = (files: File[]) => {
    const file = files[0];
    setMappingFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n");

      // 各行をカンマで分割し、1~3列目のみに絞る
      const records = lines.map((line) => {
        const columns = line.split(",");
        return columns.slice(0, 3);
      });

      // 「割増賃金」の行を探す
      let startIndex = -1;
      for (let i = 0; i < records.length; i++) {
        if (records[i][0] && records[i][0].includes("割増賃金")) {
          startIndex = i;
          break;
        }
      }

      if (startIndex === -1) {
        console.log("「割増賃金」の行が見つかりませんでした");
        return;
      }

      // 1列目に「欠勤控除」がある行を探す
      let endIndex = -1;
      for (let i = startIndex + 1; i < records.length; i++) {
        if (records[i][0] && records[i][0].includes("欠勤控除")) {
          endIndex = i;
          break;
        }
      }

      if (endIndex === -1) {
        endIndex = records.length;
      }

      // 範囲のデータを抽出（2,3列目）
      const result: OvertimeData[] = [];
      for (let i = startIndex; i < endIndex; i++) {
        const row = records[i];
        if (row[1] || row[2]) {
          result.push({
            freee: row[1] || "",
            current: row[2] || "",
          });
        }
      }

      setOvertimeData(result);
    };

    reader.readAsText(file);
  };

  // 現行給与ファイルを処理する関数
  const handleCurrentSalaryFileSelect = (files: File[]) => {
    const file = files[0];
    setCurrentSalaryFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        console.log("CSVファイルが空またはヘッダーのみです");
        return;
      }

      const headerLine = lines[0].replace(/^\s*\d+→/, ""); // 行番号を削除
      const headers = headerLine.split(",");
      setCurrentSalaryColumns(headers);

      const data: CurrentSalaryData[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].replace(/^\s*\d+→/, ""); // 行番号を削除
        const values = line.split(",");

        // 空行をスキップ
        if (values.every((v) => !v.trim())) {
          continue;
        }

        const row: CurrentSalaryData = {};
        headers.forEach((header, index) => {
          row[header] = values[index]?.replace(/"/g, "") || "";
        });
        data.push(row);
      }

      setCurrentSalaryData(data);
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
    return generatePrompt(overtimeData, filteredCurrentSalaryData);
  }, [overtimeData, filteredCurrentSalaryData]);

  return (
    <ContentsBase>
      <VStack mb={2}>
        <PageTitle>Indeedee Prompt</PageTitle>
        <SectionTitle>マッピング</SectionTitle>
        <FileUploader
          acceptFileTypes={["text/csv"]}
          fileLabel=""
          multiple={false}
          onFileSelect={handleMappingFileSelect}
        />
        {mappingFile && <Text>{mappingFile.name}</Text>}
        {overtimeData.length > 0 && (
          <Table
            columns={
              [
                {
                  name: "freee",
                  label: "freee",
                  content: "freee",
                  align: "left",
                  widthRem: 10,
                },
                {
                  name: "current",
                  label: "現行給与",
                  content: "現行給与",
                  align: "left",
                  widthRem: 10,
                },
              ] as Column[]
            }
            rows={overtimeData.map(
              (item) =>
                ({
                  cells: [
                    {
                      columnName: "freee",
                      content: item.freee,
                    },
                    {
                      columnName: "current",
                      content: item.current,
                    },
                  ],
                } as Row)
            )}
            fixMode="header"
            verticalBorder="all"
            outerBorder="all"
          />
        )}
      </VStack>
      <VStack mb={2}>
        <SectionTitle>現行給与</SectionTitle>
        <FileUploader
          acceptFileTypes={["text/csv"]}
          fileLabel=""
          multiple={false}
          onFileSelect={handleCurrentSalaryFileSelect}
        />
        {currentSalaryFile && <Text>{currentSalaryFile.name}</Text>}
        {currentSalaryData.length > 0 && (
          <>
            <CheckBox
              name="filter"
              value="filter"
              checked={filterApplied}
              onChange={() => setFilterApplied(!filterApplied)}
            >
              フィルターを適用
            </CheckBox>
            {filterApplied && (
              <HStack>
                <SingleComboBox
                  options={currentSalaryColumns.map((col) => ({
                    id: col,
                    label: col,
                  }))}
                  value={{
                    id: filterColumn || "",
                    label: filterColumn || "",
                  }}
                  onChange={(value) => {
                    setFilterColumn(String(value?.id) || null);
                    setFilterValues([]); // カラム変更時にフィルター値をリセット
                  }}
                />
                <MultiComboBox
                  options={availableFilterValues.map((value) => ({
                    id: value,
                    label: value,
                  }))}
                  values={
                    filterValues
                      ? filterValues.map((value) => ({
                          id: value,
                          label: value,
                        }))
                      : []
                  }
                  width="large"
                  onChange={(value) =>
                    setFilterValues(value?.map((v) => String(v.id)) || [])
                  }
                />
              </HStack>
            )}
            <Table
              columns={currentSalaryColumns.map((col) => ({
                name: col,
                label: col,
                content: col,
                align: "left" as const,
                widthRem: 6,
              }))}
              rows={filteredCurrentSalaryData.map((item) => ({
                cells: currentSalaryColumns.map((col) => ({
                  columnName: col,
                  content: item[col] || "",
                })),
              }))}
              fixMode="header"
              verticalBorder="all"
              outerBorder="all"
            />
          </>
        )}
      </VStack>
      <VStack mb={2}>
        <SectionTitle>プロンプト</SectionTitle>
        {generatedPrompt && (
          <>
            <Button
              primary
              onClick={() => {
                navigator.clipboard.writeText(generatedPrompt);
                setShowCopiedMessage(true);
              }}
            >
              クリップボードにコピー
            </Button>
            <TextArea height={20} value={generatedPrompt} />
          </>
        )}
      </VStack>
      {showCopiedMessage && (
        <FloatingMessageBlock
          onClose={() => setShowCopiedMessage(false)}
          success
        >
          クリップボードにコピーしました
        </FloatingMessageBlock>
      )}
    </ContentsBase>
  );
}

export default App;
