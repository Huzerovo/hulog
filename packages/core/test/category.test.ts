import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCategories,
  categoryPathToUrl,
  categoryPathToString,
  buildCategoryTree,
} from "../src/category.js";

test("parseCategories: 顶层字符串 / 数组", () => {
  assert.deepEqual(parseCategories(["a", "b"]), [["a"], ["b"]]);
  assert.deepEqual(parseCategories("a"), [["a"]]);
  assert.deepEqual(parseCategories(undefined), []);
});

test("parseCategories: 嵌套映射 → 子分类（任意深度）", () => {
  const paths = parseCategories([{ 分类二: ["子1", "子2"] }]);
  assert.deepEqual(paths, [
    ["分类二", "子1"],
    ["分类二", "子2"],
  ]);
  const deep = parseCategories([{ 顶层: [{ 中层: ["叶子"] }] }]);
  assert.deepEqual(deep, [["顶层", "中层", "叶子"]]);
});

test("parseCategories: 父/子 路径写法", () => {
  assert.deepEqual(parseCategories(["分类三/子分类"]), [["分类三", "子分类"]]);
});

test("parseCategories: 去重且保持出现顺序", () => {
  assert.deepEqual(parseCategories(["a", "a", "a/b", "a/b"]), [["a"], ["a", "b"]]);
});

test("parseCategories: 空对象/空数组值 → 仅作为叶子分类", () => {
  assert.deepEqual(parseCategories([{ a: [] }, { b: {} }, { c: null }]), [
    ["a"],
    ["b"],
    ["c"],
  ]);
});

test("categoryPathToString: 以 / 连接", () => {
  assert.equal(categoryPathToString(["a", "b"]), "a/b");
});

test("categoryPathToUrl: 编码段并补全斜杠", () => {
  assert.equal(
    categoryPathToUrl(["分类", "子 分类"]),
    "/categories/%E5%88%86%E7%B1%BB/%E5%AD%90%20%E5%88%86%E7%B1%BB/",
  );
  assert.equal(
    categoryPathToUrl(["a"], "/taxonomy"),
    "/taxonomy/a/",
  );
});

test("buildCategoryTree: 祖先节点计数累加", () => {
  const tree = buildCategoryTree([
    ["a", "b"],
    ["a", "c"],
    ["a", "b"],
    ["d"],
  ]);
  assert.equal(tree.length, 2);
  const a = tree.find((n) => n.name === "a");
  assert.equal(a?.count, 3);
  assert.equal(a?.children.length, 2);
  assert.equal(a?.children.find((c) => c.name === "b")?.count, 2);
  assert.equal(a?.children.find((c) => c.name === "c")?.count, 1);
  assert.equal(tree.find((n) => n.name === "d")?.count, 1);
});

test("buildCategoryTree: 按名称排序", () => {
  const tree = buildCategoryTree([["b"], ["a"]]);
  assert.deepEqual(
    tree.map((n) => n.name),
    ["a", "b"],
  );
});
