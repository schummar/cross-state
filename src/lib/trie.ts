import type { KeyType } from '@lib/path';

class TrieNode {
  children: Map<KeyType, TrieNode> = new Map();
  isLeaf = false;
}

export class Trie {
  root: TrieNode = new TrieNode();

  add(path: KeyType[]): void {
    let node = this.root;
    for (const key of path) {
      let next = node.children.get(key);
      if (!next) node.children.set(key, (next = new TrieNode()));
      node = next;
    }
    node.isLeaf = true;
  }

  hasSubPath(path: KeyType[]): boolean {
    let node = this.root;
    for (const key of path) {
      const next = node.children.get(key);
      if (!next) return false;
      node = next;
    }
    return node.isLeaf;
  }
}
