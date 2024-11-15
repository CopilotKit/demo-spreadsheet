import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { useCopilotSuggestions } from "@copilotkit/react-ui";

import React, { useCallback, useState } from "react";
import Spreadsheet, { Point } from "react-spreadsheet";
import { canonicalSpreadsheetData } from "../utils/canonicalSpreadsheetData";
import { SpreadsheetData, SpreadsheetRow } from "../types";
import { PreviewSpreadsheetChanges } from "./PreviewSpreadsheetChanges";
import { ClipLoader } from "react-spinners";

interface MainAreaProps {
  spreadsheet: SpreadsheetData;
  setSpreadsheet: (spreadsheet: SpreadsheetData) => void;
}

const SingleSpreadsheet = ({ spreadsheet, setSpreadsheet }: MainAreaProps) => {
  useCopilotReadable({
    description: "The current spreadsheet",
    value: spreadsheet,
  });

  useCopilotAction({
    name: "suggestSpreadsheetOverride",
    description: "Suggest an override of the current spreadsheet",
    parameters: [
      {
        name: "title",
        type: "string",
        description: "The title of the spreadsheet",
      },
      {
        name: "rows",
        type: "object[]",
        description: "The rows of the spreadsheet",
        attributes: [
          {
            name: "cells",
            type: "object[]",
            description: "The cells of the row",
            attributes: [
              {
                name: "value",
                type: "string",
                description: "The value of the cell",
              },
            ],
          },
        ],
      },
      {
        name: "title",
        type: "string",
        description: "The title of the spreadsheet",
        required: false,
      },
    ],
    render: (props) => {
      const { rows } = props.args;
      const newRows = canonicalSpreadsheetData(rows);

      return (
        <PreviewSpreadsheetChanges
          preCommitTitle="Replace contents"
          postCommitTitle="Changes committed"
          newRows={newRows}
          commit={(rows) => {
            const updatedSpreadsheet: SpreadsheetData = {
              title: spreadsheet.title,
              rows: rows,
            };
            setSpreadsheet(updatedSpreadsheet);
          }}
        />
      );
    },
    handler: ({ rows, title }) => {
      // Do nothing.
      // The preview component will optionally handle committing the changes.
    },
  });

  useCopilotAction({
    name: "appendToSpreadsheet",
    description: "Append rows to the current spreadsheet",
    parameters: [
      {
        name: "rows",
        type: "object[]",
        description: "The new rows of the spreadsheet",
        attributes: [
          {
            name: "cells",
            type: "object[]",
            description: "The cells of the row",
            attributes: [
              {
                name: "value",
                type: "string",
                description: "The value of the cell",
              },
            ],
          },
        ],
      },
    ],
    render: (props) => {
      const status = props.status;
      const { rows } = props.args;
      const newRows = canonicalSpreadsheetData(rows);
      return (
        <div>
          <p>Status: {status}</p>
          <Spreadsheet data={newRows} />
        </div>
      );
    },
    handler: ({ rows }) => {
      const canonicalRows = canonicalSpreadsheetData(rows);
      const updatedSpreadsheet: SpreadsheetData = {
        title: spreadsheet.title,
        rows: [...spreadsheet.rows, ...canonicalRows],
      };
      setSpreadsheet(updatedSpreadsheet);
    },
  });

  // export interface Cell {
  //   value: string;
  // }

  // export type SpreadsheetRow = Cell[];

  // export interface SpreadsheetData {
  //   title: string;
  //   rows: SpreadsheetRow[];
  // }

  const [activeCell, setActiveCell] = useState<Point | undefined>(undefined);
  let activeCellData: string | undefined = undefined;
  if (activeCell !== undefined) {
    activeCellData = spreadsheet.rows[activeCell.row][activeCell.column].value;
  }
  let spreadsheetIsEmpty = true;
  for (const row of spreadsheet.rows) {
    for (const cell of row) {
      if (cell.value?.trim() !== "") {
        spreadsheetIsEmpty = false;
        break;
      }
    }
  }

  const { suggestions, isAvailable, isLoading } = useCopilotSuggestions(
    {
      instructions:
        "Based on the user's current spreadsheet and the cell they are working on, try " +
        "to help the user by auto-completing what they might want to achieve. You can " +
        "autocomplete the cell they are working on, or make any other changes to the spreadsheet. " +
        "You must always return the complete spreadsheet, including all rows and columns. " +
        "The user currently selected cell is: " +
        JSON.stringify(activeCell) +
        " " +
        "The value of the cell is: " +
        activeCellData,
      value: { rows: spreadsheet.rows.map((row) => ({ cells: row })) },
      enabled: !!activeCell && !spreadsheetIsEmpty,
      parameters: [
        {
          name: "rows",
          type: "object[]",
          description: "The new rows of the spreadsheet",
          attributes: [
            {
              name: "cells",
              type: "object[]",
              description: "The cells of the row",
              attributes: [
                {
                  name: "value",
                  type: "string",
                  description: "The value of the cell",
                },
              ],
            },
          ],
        },
      ],
    },
    [JSON.stringify(activeCell), activeCellData, JSON.stringify(spreadsheet)]
  );

  console.log(suggestions, isAvailable, isLoading);
  const handleAutoComplete = useCallback(() => {
    if (isAvailable) {
      setSpreadsheet({
        ...spreadsheet,
        rows: canonicalSpreadsheetData(suggestions.rows),
      });
    }
  }, [suggestions, isAvailable, spreadsheet]);

  // Add event listener for keydown event
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        handleAutoComplete();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleAutoComplete]);

  return (
    <div className="w-full">
      <div className="flex-1 overflow-auto p-5 w-full">
        <input
          type="text"
          value={spreadsheet.title}
          className="w-full p-2 mb-5 text-center text-2xl font-bold outline-none bg-transparent"
          onChange={(e) =>
            setSpreadsheet({ ...spreadsheet, title: e.target.value })
          }
        />
        <div className="flex items-start">
          <Spreadsheet
            data={spreadsheet.rows}
            onChange={(data) => {
              setSpreadsheet({ ...spreadsheet, rows: data as any });
            }}
            onActivate={(cell) => {
              setActiveCell(cell);
            }}
            onBlur={() => {
              setActiveCell(undefined);
            }}
          />
          <button
            className="bg-blue-500 text-white rounded-lg ml-6 w-8 h-8 mt-0.5"
            onClick={() => {
              // add an empty cell to each row
              const spreadsheetRows = [...spreadsheet.rows];
              for (let i = 0; i < spreadsheet.rows.length; i++) {
                spreadsheet.rows[i].push({ value: "" });
              }
              setSpreadsheet({
                ...spreadsheet,
                rows: spreadsheetRows,
              });
            }}
          >
            +
          </button>

          {(isLoading || isAvailable) && (
            <div className="relative">
              <div
                className="absolute max-w-sm overflow-auto text-xs bg-white rounded-lg p-5 shadow-lg ml-5"
                style={{
                  top: "100%",
                  zIndex: 1000,
                }}
              >
                {isLoading && (
                  <div className="font-medium mb-2 w-52 flex items-center">
                    Loading completions
                    <ClipLoader size={16} className="ml-2" />
                  </div>
                )}
                {!isLoading && (
                  <>
                    <div className="font-medium mb-2">Auto-complete? (⌘K)</div>
                    <table className="table-auto w-full">
                      <tbody>
                        {suggestions?.rows?.map((suggestion, rowIndex) => (
                          <tr key={rowIndex}>
                            {suggestion.cells.map((cell, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="border px-4 py-2 whitespace-nowrap"
                              >
                                {cell.value}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          )}
          {isLoading && (
            <div className="flex justify-center mt-2 ml-5">
              <ClipLoader />
            </div>
          )}
        </div>
        <button
          className="bg-blue-500 text-white rounded-lg w-8 h-8 mt-5 "
          onClick={() => {
            const numberOfColumns = spreadsheet.rows[0].length;
            const newRow: SpreadsheetRow = [];
            for (let i = 0; i < numberOfColumns; i++) {
              newRow.push({ value: "" });
            }
            setSpreadsheet({
              ...spreadsheet,
              rows: [...spreadsheet.rows, newRow],
            });
          }}
        >
          +
        </button>
      </div>
    </div>
  );
};

export default SingleSpreadsheet;
