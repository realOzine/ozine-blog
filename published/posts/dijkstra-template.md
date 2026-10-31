---
title: Dijkstra算法模板
date: 2019-12-29
---

<font color=#FF8C00> 我是练习时长5分钟的 Dijkstra算法 实习生</font> **QAQ**

相当纯粹的模板 ~~裸题~~

给定一个n个点m条边的有向图，图中可能存在重边和自环，所有边权均为正值。

请你求出1号点到n号点的最短距离，如果无法从1号点走到n号点，则输出-1。

#### **输入格式**

第一行包含整数n和m。

接下来m行每行包含三个整数x，y，z，表示存在一条从点x到点y的有向边，边长为z。

#### **输出格式**

输出一个整数，表示1号点到n号点的最短距离。

如果路径不存在，则输出-1。

#### **数据范围**

 1≤n≤5001≤n≤500,
		1≤m≤1051≤m≤105,
		图中涉及边长均不超过10000。

```c++
#include <iostream>
#include <cstring>
#include <algorithm>

using namespace std;

const int N = 510;
int dist[N], g[N][N];
int n, m;
int st[N];

int dijkstra()
{
    memset(dist, 0x3f, sizeof dist);
    
    dist[1] = 0;
    for(int i = 1; i <= n; i ++)
    {
        int t = -1;
        for(int j = 1; j <= n; j++ )
        {
            if(!st[j] && (t == -1 || dist[t] > dist[j])) t = j;
        }
        
        st[t] = true;
        
        for(int j = 1; j <= n; j ++)
            dist[j] = min(dist[j], dist[t] + g[t][j] );
    }
    
    if(dist[n] == 0x3f3f3f3f) return -1;
    else return dist[n];
}

int main(void)
{
    ios::sync_with_stdio(0); cin.tie(0); cout.tie(0);
    
    cin >> n >> m;
    
    memset(g, 0x3f, sizeof g);
    
    for(int i = 1; i <= m; i ++ )
    {
        int a, b, c;
        cin >> a >> b >> c;
        g[a][b] = min(g[a][b], c);
    }
    
    int t = dijkstra();
    
    cout << t << endl;
    
    return 0;
}
```

