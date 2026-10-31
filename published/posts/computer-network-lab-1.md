---
title: 计网实验记录(1)
date: 2020-11-06
---

[项目地址](https://github.com/Ozine233/net_lab/tree/main/lab1)

### 1. 聊天协议说明

**聊天协议 CCP(Chat Control Protocol)**

 * 状态码（1字节） 功能                			客户端指令
 * 00000001		注册名字				    register <nick_name>
 * 00000010		发送消息				    send <group_id>  <message>
 * 00000100		列出在线的群		     list
 * 00001000		加入某个群			     join <group_id>
 * 00010000		创建一个群			     create <group_name>
 * 00100000		设置群为限制加入	  limit <group_id>
 * 01000000		退出某个群聊			 quit <group_id> 
 * 10000000		退出					        exit

客户端与服务端的通信通过 socket 传送 chat_packet 实现, 其定义如下:

```c++
typedef struct chat_packet
{
	// 状态码
	byte state_code;

	// 消息长度
	byte msg_len;

	// 消息
	char msg[0];
}chat_packet;
```

首先在客户端，根据用户输入指令和参数，将该信息封装为 chat_packet 结构体, 并将其强制类型转换为字符串，通过 socket 将该消息传递到服务端，服务端收到消息后，又将其强制转换为 chat_packet 结构体类型，分别读取其中的状态码，消息等信息，根据该 CCP 协议的规则，做出回应.

### 2. 实现聊天的逻辑

#### 服务端

**核心思路**：服务端作为核心，保持和客户端的 TCP 长连接，负责转发消息，实现多人聊天

服务端维护两个数据结构:

1. 当前在线的群组 (*用数组实现*)
2. 每个群组中的客户端信息(*用链表实现*)

客户端信息用如下结构体存储:

```c++
typedef struct client_info
{
    // 客户端名字
	string name;
    
    // 客户端建立的 socket 标识符
	SOCKET socket;
    
    // 客户端的地址
	SOCKADDR_IN addr;
    
    // 地址长度
	int len = sizeof(addr);
} client_info;
```

服务端为每一个建立TCP连接的客户端创建一个线程，维持与该客户端的通信，通过与该客户端的交互，实现对服务端维护的两个数据结构的更新，同时根据这两个数据结构提供的信息完成转发消息等功能.

#### 客户端

客户端创建一个线程，负责维持与服务端的通信，接收消息并打印至屏幕上

主线程负责与用户交互，根据用户输出的指令信息，封装 chat_packet 包，并将其转化字符串通过 socket 传递至服务端

*具体分析可见代码注释*

### 3. 实验中遇到的问题

**a. 结构体在内存中不连续**

为了将 chat_packet 结构体转换为字符串，需要使用 `chat_packet *` 和 `sizeof(*chat_packet)` 将内存中一段连续的区块强制转换为字符串，并通过 socket 发送，因为该通信包中包含不定长的消息，需要使用 `char *` 成员变量存储，而这个指针通常会指向其他区域，将会导致该结构体不连续，如果采取拼接操作，过于麻烦

*解决方案*

将 `char *msg` 成员变量替换为 `char msg[0]`

并且使用 `malloc` 函数而不是 `new` 为 `chate_packet *` 分配内存， 就能保证该结构体在内存中是连续分配的.