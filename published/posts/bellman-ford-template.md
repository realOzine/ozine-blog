---
title: Bellman-Ford模板
date: 2020-01-06
---

**可以在更广泛的情况下(存在负权边) 解决单源最短路问题** 时间复杂度较高

---

给定一个n个点m条边的有向图，图中可能存在重边和自环， **边权可能为负数**。

请你求出从1号点到n号点的最多经过k条边的最短距离，如果无法从1号点走到n号点，输出impossible。

注意：图中可能 **存在负权回路** 。

#### **输入格式**

第一行包含三个整数n，m，k。

接下来m行，每行包含三个整数x，y，z，表示存在一条从点x到点y的有向边，边长为z。

#### **输出格式**

输出一个整数，表示从1号点到n号点的最多经过k条边的最短距离。

如果不存在满足条件的路径，则输出“impossible”。

#### **数据范围**

 1≤n,k≤5001≤n,k≤500,
		1≤m≤100001≤m≤10000,
		任意边长的绝对值不超过10000。



```c++
#include <iostream>
#include <cstring>
#include <algorithm>

using namespace std;

const int N = 510, M = 10010;

struct Edges
{
    int a, b ,w;
}edges[M];

int n, m, k;
int dist[N], backup[N];

int bellman_ford()
{
    memset(dist, 0x3f, sizeof dist);
    dist[1] = 0;
    
    for(int i = 1; i <= k; i ++)
    {
        memcpy(backup, dist, sizeof dist);
        for(int j = 1; j <= m; j ++)
        {
            int a = edges[j].a, b = edges[j].b, w = edges[j].w;
            dist[b] = min(dist[b], backup[a] + w);
        }
    }
    
    if(dist[n] > 0x3f3f3f3f / 2) return -1;
    else return dist[n];
}

int main(void)
{
    ios::sync_with_stdio(0); cin.tie(0); cout.tie(0);
    cin >> n >> m >> k;
    for(int i = 1; i <= m; i ++)
    {
        cin >> edges[i].a >> edges[i].b >> edges[i].w;
    }
    
    int t = bellman_ford();
    
    if(t == -1) puts("impossible");
    else cout << t << endl;
    
    return 0;
}
```

