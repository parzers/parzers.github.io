const queryInput = document.querySelector("#query");
const runButton = document.querySelector("#run-query");
const results = document.querySelector("#results");
const queryStatus = document.querySelector("#query-status");
//const tableList = document.querySelector("#table-list");

let database;

function removeComments(sql) {
  let result = "";
  let index = 0;
  let quote = null;

  while (index < sql.length) {
    const character = sql[index];
    const nextCharacter = sql[index + 1];

    if (quote) {
      result += character;
      if (character === quote) {
        if (sql[index + 1] === quote) {
          result += sql[index + 1];
          index += 2;
          continue;
        }
        quote = null;
      }
      index += 1;
      continue;
    }

    if (character === "'" || character === "\"" || character === "`") {
      quote = character;
      result += character;
      index += 1;
      continue;
    }

    if (character === "-" && nextCharacter === "-") {
      index = sql.indexOf("\n", index + 2);
      if (index === -1) {
        break;
      }
      result += "\n";
      index += 1;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      const commentEnd = sql.indexOf("*/", index + 2);
      if (commentEnd === -1) {
        throw new Error("The block comment is not closed.");
      }
      index = commentEnd + 2;
      continue;
    }

    result += character;
    index += 1;
  }

  if (quote) {
    throw new Error("The quoted value is not closed.");
  }

  return result;
}

function findStatementSeparators(sql) {
  const separators = [];
  let quote = null;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    if (quote) {
      if (character === quote) {
        if (sql[index + 1] === quote) {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === "'" || character === "\"" || character === "`") {
      quote = character;
    } else if (character === ";") {
      separators.push(index);
    }
  }

  return separators;
}

function validateSelectStatement(sql) {
  const withoutComments = removeComments(sql).trim();
  if (!withoutComments) {
    throw new Error("Enter a SELECT statement.");
  }

  const separators = findStatementSeparators(withoutComments);
  if (separators.length > 1 || (separators.length === 1 && separators[0] !== withoutComments.length - 1)) {
    throw new Error("Only one statement is allowed.");
  }

  const statement = withoutComments.replace(/;$/, "").trim();
  if (!/^SELECT\b/i.test(statement)) {
    throw new Error("Only SELECT statements are allowed.");
  }

  return statement;
}

function clearResults() {
  results.replaceChildren();
}

function showMessage(message, className) {
  clearResults();
  const paragraph = document.createElement("p");
  paragraph.className = className;
  paragraph.textContent = message;
  results.append(paragraph);
}

function renderResultSets(resultSets) {
  clearResults();

  if (resultSets.length === 0) {
    showMessage("The query completed without returning any columns.", "empty-state");
    return 0;
  }
  let rowCount = 0;
  for (const resultSet of resultSets) {
    const table = document.createElement("table");
    const headerRow = document.createElement("tr");
    const header = document.createElement("thead");
    const body = document.createElement("tbody");

    for (const column of resultSet.columns) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = column;
      headerRow.append(cell);
    }
    header.append(headerRow);

    for (const row of resultSet.values) {
      const tableRow = document.createElement("tr");
      for (const value of row) {
        const cell = document.createElement("td");
        const div = document.createElement("div");
        div.textContent = value === null ? "NULL" : String(value);
        cell.append(div)
        tableRow.append(cell);
      }
      body.append(tableRow);
      rowCount += 1;
    }

    table.append(header, body);
    results.append(table);
  }

  return rowCount;
}

function renderTableList(resultSets) {
  tableList.replaceChildren();
  for (const resultSet of resultSets) {
    for (const row of resultSet.values) {
      const item = document.createElement("li");
      const name = document.createElement("code");
      name.textContent = row[0];
      item.append(name);
      tableList.append(item);
    }
  }
}

function executeQuery() {
  try {
    const statement = validateSelectStatement(queryInput.value);
    const resultSets = database.exec(statement);
    const rowCount = renderResultSets(resultSets);
    queryStatus.textContent = `${rowCount} row${rowCount === 1 ? "" : "s"} returned.`;
    results.focus({ preventScroll: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showMessage(message, "error-message");
    queryStatus.textContent = "Query was not executed.";
  }
}

async function loadDatabase() {
  try {
    const SQL = await initSqlJs({
      locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`,
    });
    const response = await fetch("sql-murder-mystery.db");
    if (!response.ok) {
      throw new Error(`Database could not be loaded (${response.status} ${response.statusText}).`);
    }

    database = new SQL.Database(new Uint8Array(await response.arrayBuffer()));
    //renderTableList(database.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"));
    runButton.disabled = false;
    runButton.textContent = "Run SELECT query";
    queryStatus.textContent = "Database ready.";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showMessage(message, "error-message");
    queryStatus.textContent = message;
    runButton.textContent = "Database unavailable";
  }
}

runButton.addEventListener("click", executeQuery);
queryInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    if (!runButton.disabled) {
      executeQuery();
    }
  }
});

loadDatabase();
