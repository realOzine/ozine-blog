---
title: win下查看路由表
date: 2020-12-24
---

## 1 什么是路由表

>维基百科：
>
>在[计算机网络](https://zh.wikipedia.org/wiki/计算机网络)中，**路由表**（routing table）或称**路由择域信息库**（RIB, Routing Information Base），是一个存储在[路由器](https://zh.wikipedia.org/wiki/路由器)或者联网计算机中的电子表格（文件）或[类数据库](https://zh.wikipedia.org/w/index.php?title=类数据库&action=edit&redlink=1)。路由表存储着指向特定网络地址的路径（在有些情况下，还记录有路径的[路由度量值](https://zh.wikipedia.org/w/index.php?title=路由度量值&action=edit&redlink=1)）。路由表中含有网络周边的[拓扑](https://zh.wikipedia.org/wiki/拓扑)信息。路由表创建的主要目标是为了实现[路由协议](https://zh.wikipedia.org/wiki/路由协议)和静态路由选择。
>
>在现代路由器构造中，路由表不直接参与[数据包](https://zh.wikipedia.org/wiki/数据包)的传输，而是用于生成一个小型指向表，这个指向表仅仅包含由路由算法选择的数据包传输优先路径，这个表格通常为了优化硬件存储和查找而被压缩或提前编译。

## 2 win下查看路由表

在 windows 环境下（cmd）查看路由表：

指令：route print

![路由表](https://cdn.jsdelivr.net/gh/Ozine233/myPic@master/img/20201224234105.png)

Network Destination 目的网络

Netmask 网络掩码

Gateway 网关（下一跳地址）

Interface 接口（出口地址）

Metric 跃点数 （这里表示路由优先值，小的优先）



**在链路上** 表示数据报直接送往目标地址，不需要经过网关（也即下一跳地址）



