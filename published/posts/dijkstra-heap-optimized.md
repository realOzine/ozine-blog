---
title: Dijkstra堆优化版
date: 2020-01-04
---

## **时间复杂度**：

**朴素Dijkstra** —–> O(n^2)

**堆优化Dijkstra** —–> O(mlogn)

其中 n 是顶点数， m 是边数， 显然在稀疏图的时候，堆优化 奥利给！！！

---

<font color=#ADFF2F> 以下为模板</font>

给定一个n个点m条边的有向图，图中可能存在重边和自环，所有边权均为非负值。

请你求出1号点到n号点的最短距离，如果无法从1号点走到n号点，则输出-1。

#### **输入格式**

第一行包含整数n和m。

接下来m行每行包含三个整数x，y，z，表示存在一条从点x到点y的有向边，边长为z。

#### **输出格式**

输出一个整数，表示1号点到n号点的最短距离。

如果路径不存在，则输出-1。

#### **数据范围**

1≤n,m≤1051≤n,m≤105,
		图中涉及边长均不小于0，且不超过10000。

```c++
#include <iostream>
#include <algorithm>
#include <vector>
#include <queue>
#include <cstring>

using namespace std;

typedef pair<int, int> PII;

const int N = 100010;
int h[N], e[N], w[N], ne[N], idx;
int n, m, st[N], dist[N];

int dijkstra()
{
    memset(dist, 0x3f, sizeof dist);
    dist[1] = 0;
    
    priority_queue<PII, vector<PII>, greater<PII>> heap;
    heap.push({0, 1});
    
    while(heap.size())
    {
        auto t = heap.top();
        heap.pop();
        
        int ver = t.second, distance = t.first;
        if(st[ver]) continue;
        
        for(int i = h[ver]; i != -1; i = ne[i])
        {
            int j = e[i];
            if(dist[j] > dist[ver] + w[i])
                dist[j] = dist[ver] + w[i];
            heap.push({dist[j], j});
        }
        st[ver] = true;
    }
    
    if(dist[n] == 0x3f3f3f3f) return -1;
    return dist[n];
}

void add(int a, int b, int c)
{
    e[idx] = b; w[idx] = c; ne[idx] = h[a]; h[a] = idx ++;
}

int main(void)
{
    ios::sync_with_stdio(0); cin.tie(0); cout.tie(0);
    memset(h, -1, sizeof h);
    cin >> n >> m;
    while(m --)
    {
        int a, b, c;
        cin >> a >> b >> c;
        add(a, b, c);
    }
    
    cout << dijkstra() << endl;
    
    return 0;
}
```

