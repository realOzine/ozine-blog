---
title: 红黑树
date: 2019-12-27
---

哭了，边玩边写红黑树的下场。

*大量制造辣鸡代码*

<img src="http://s1.wailian.download/2019/12/27/5CF1E8EA72FE858A4535C3F9F1B5438E.jpg" style="zoom:70%;" />

## 一、红黑树原理分析

- [ ] 待分析，考完试就来！！

## 二、实现过程详解

- [ ] 待详解， 考完试就来！！

## 三、代码（c++）

- [ ] 待优化的垃圾版本

勉强先看看吧，还是  ~~不~~ 贴上来了。



```c++
#include <iostream>

using namespace std;

enum color
{
    black,
    red
};

template <class T>
class Node
{
public:
    Node()
    {
        color = red;
        LeftChild = RightChild = nullptr;
    }
    Node(const T &data)
    {
        color = red;
        this->data = data;
        LeftChild = RightChild = nullptr;
    }
    Node(const T &data, Node<T> *left, Node<T> *right)
    {
        color = red;
        this->data = data;
        LeftChild = left;
        RightChild = right;
    }

    color color;
    T data;
    Node *LeftChild;
    Node *RightChild;
};

template <class T>
class RedBlackTree
{
public:
    RedBlackTree();
    ~RedBlackTree();
    RedBlackTree<T> &Insert(const T &e);
    RedBlackTree<T> &Remove(const T &e);

protected:
    void rorateLeft(Node<T> **p, Node<T> **pp, Node<T> **ppp);
    void rorateRight(Node<T> **p, Node<T> **pp, Node<T> **ppp);
    void handleReorient(Node<T> **p, Node<T> **pp, Node<T> **ppp, Node<T> **pppp, int flag);
    int getCase(Node<T> *ppp, Node<T> *pp, Node<T> *p);
    bool fixRemove(Node<T> *p, Node<T> *pp, Node<T> *ppp);

private:
    Node<T> *header, *nil;
    unsigned TreeSize;
};

template <class T>
RedBlackTree<T>::RedBlackTree()
{
    header = new Node<T>();
    header->color = black;
    nil = new Node<T>();
    nil->color = black;
    header->LeftChild = header->RightChild = nil;
    TreeSize = 0;
}

template <class T>
RedBlackTree<T>::~RedBlackTree()
{
}

template <class T>
void RedBlackTree<T>::rorateLeft(Node<T> **p, Node<T> **pp, Node<T> **ppp)
{
    (*pp)->RightChild = (*p)->LeftChild;
    (*p)->LeftChild = (*pp);
    if ((*ppp)->RightChild == (*pp))
        (*ppp)->RightChild = (*p);
    else
        (*ppp)->LeftChild = (*p);
    (*pp) = (*p);
    (*p) = (*pp)->LeftChild;
}

template <class T>
void RedBlackTree<T>::rorateRight(Node<T> **p, Node<T> **pp, Node<T> **ppp)
{
    (*pp)->LeftChild = (*p)->RightChild;
    (*p)->RightChild = (*pp);
    if ((*ppp)->RightChild == (*pp))
        (*ppp)->RightChild = (*p);
    else
        (*ppp)->LeftChild = (*p);
    (*pp) = (*p);
    (*p) = (*pp)->RightChild;
}

template <class T>
void RedBlackTree<T>::handleReorient(Node<T> **p, Node<T> **pp, Node<T> **ppp, Node<T> **pppp, int flag)
{
    switch (flag)
    {
    case 1: //*ppp-(L)->pp-(L)->p
        (*pp)->color = black;
        (*ppp)->color = red;
        rorateRight(pp, ppp, pppp);
        break;
    case 2: //*ppp-(L)->pp-(R)->p
        rorateLeft(p, pp, ppp);
        (*pp)->color = black;
        (*ppp)->color = red;
        rorateRight(pp, ppp, pppp);
        break;
    case 3: //*ppp-(R)->pp-(R)->p
        (*pp)->color = black;
        (*ppp)->color = red;
        rorateLeft(pp, ppp, pppp);
        break;
    case 4: //*ppp-(R)->pp-(L)->p
        rorateRight(p, pp, ppp);
        (*pp)->color = black;
        (*ppp)->color = red;
        rorateLeft(pp, ppp, pppp);
        break;
    }
}

template <class T>
int RedBlackTree<T>::getCase(Node<T> *ppp, Node<T> *pp, Node<T> *p)
{
    if (ppp->LeftChild == pp)
    {
        if (pp->LeftChild == p)
            return 1;
        else
            return 2;
    }
    else
    {
        if (pp->RightChild == p)
            return 3;
        else
            return 4;
    }
    cout << "Wrong" << endl;
}

template <class T>
RedBlackTree<T> &RedBlackTree<T>::Insert(const T &e)
{
    Node<T> *pppp = nullptr, *ppp = nullptr, *pp = header, *p = pp->RightChild;
    while (p != nil)
    {
        if (p->LeftChild->color == red && p->RightChild->color == red)
        {
            p->LeftChild->color = p->RightChild->color = black;
            p->color = red;
            if (p == header->RightChild)
                p->color = black;
            else
            {
                if (pp->color == red)
                    handleReorient(&p, &pp, &ppp, &pppp, getCase(ppp, pp, p));
            }
        }
        pppp = ppp;
        ppp = pp;
        pp = p;
        if (e > p->data)
            p = p->RightChild;
        if (e < p->data)
            p = p->LeftChild;
        if (e == p->data)
        {
            cout << "The value of " << e << " duplicated！！" << endl;
            return *this;
        }
    }
    if (p == header->RightChild)
    {
        header->RightChild = new Node<T>(e, nil, nil);
        header->RightChild->color = black;
    }
    else
    {
        if (pp->RightChild == p)
        {
            pp->RightChild = new Node<T>(e, nil, nil);
            p = pp->RightChild;
        }
        else
        {
            pp->LeftChild = new Node<T>(e, nil, nil);
            p = pp->LeftChild;
        }
        if (pp->color == red)
        {
            handleReorient(&p, &pp, &ppp, &pppp, getCase(ppp, pp, p));
        }
    }
    TreeSize++;
    return *this;
}

template <class T>
RedBlackTree<T> &RedBlackTree<T>::Remove(const T &e)
{
    Node<T> *p = header->RightChild, *pp = header, *ppp = nullptr;
    while (p != nil && p->data != e)
    {
        ppp = pp;
        pp = p;
        if (e > p->data)
            p = p->RightChild;
        else
            p = p->LeftChild;
    }
    if (p == nil)
    {
        cout << "can't find the value of " << e << endl;
        return *this;
    }
    TreeSize--;
    if (p->LeftChild != nil && p->RightChild != nil)
    {
        Node<T> *pps = pp, *ps = p, *s = p->LeftChild;
        while (s->RightChild != nil)
        {
            pps = ps;
            ps = s;
            s = s->RightChild;
        }
        p->data = s->data;
        ppp = pps;
        pp = ps;
        p = s;
    }
    if (p->LeftChild != nil)
    {
        if (p->color == red)
        {
            if (pp->RightChild == p)
                pp->RightChild = p->LeftChild;
            else
                pp->LeftChild = p->LeftChild;
            delete[] p;
            return *this;
        }
        else
        {
            if (pp->RightChild == p)
                pp->RightChild = p->LeftChild;
            else
                pp->LeftChild = p->LeftChild;
            p->LeftChild->color = black;
            delete[] p;
            return *this;
        }
    }
    if (p->RightChild != nil)
    {
        if (p->color == red)
        {
            if (pp->RightChild == p)
                pp->RightChild = p->RightChild;
            else
                pp->LeftChild = p->RightChild;
            delete[] p;
            return *this;
        }
        else
        {
            if (pp->RightChild == p)
                pp->RightChild = p->RightChild;
            else
                pp->LeftChild = p->RightChild;
            p->RightChild->color = black;
            delete[] p;
            return *this;
        }
    }
    if (p->color == red || p == header->RightChild)
    {
        if (pp->RightChild == p)
            pp->RightChild = nil;
        else
            pp->LeftChild = nil;
        delete[] p;
        return *this;
    }
    else
    {
        if (pp->color == red)
        {
            delete[] p;
            p->color = red;
            pp->color = black;
            return *this;
        }
        else
        {
            Node<T> *b;
            if (pp->RightChild == p && pp->LeftChild->color == red)
            {
                b = pp->LeftChild;
                b->color = black;
                pp->RightChild = nil;
                delete[] p;
                rorateRight(&b, &pp, &ppp);
                return *this;
            }
            if (pp->LeftChild == p && pp->RightChild->color == red)
            {
                b = pp->RightChild;
                b->color = black;
                pp->LeftChild = nil;
                delete[] p;
                rorateLeft(&b, &pp, &ppp);
                return *this;
            }

            //! last case which can't be banlanced in this Tree, should scale up!
            if (pp->RightChild == p)
            {
                b = pp->LeftChild;
                if (b->LeftChild != nil)
                {
                    b->LeftChild->color = black;
                    pp->RightChild = nil;
                    delete[] p;
                    rorateRight(&b, &pp, &ppp);
                    return *this;
                }
                else if (b->RightChild != nil)
                {
                    pp->RightChild = nil;
                    delete[] p;
                    b->RightChild->color = black;
                    rorateLeft(&(b->RightChild), &b, &pp);
                    rorateRight(&b, &pp, &ppp);
                    return *this;
                }

                //todo: all black and bro on the left
                pp->RightChild = nil;
                delete[] p;
                b->color = red;
                fixRemove(pp,header->RightChild,header);
                return *this;
            }
            if (pp->LeftChild == p)
            {
                b = pp->RightChild;
                if (b->RightChild != nil)
                {
                    b->RightChild->color = black;
                    pp->LeftChild = nil;
                    delete[] p;
                    rorateLeft(&b, &pp, &ppp);
                    return *this;
                }
                else if (b->LeftChild != nil)
                {
                    pp->LeftChild = nil;
                    delete[] p;
                    b->LeftChild->color = black;
                    rorateRight(&(b->LeftChild), &b, &pp);
                    rorateLeft(&b, &pp, &ppp);
                    return *this;
                }
                //todo: all black and bro on the right
                pp->LeftChild = nil;
                delete[] p;
                b->color = red;
                fixRemove(pp,header->RightChild,header);
                return *this;
            }
        }
    }
}

template <class T>
bool RedBlackTree<T>::fixRemove(Node<T> *p, Node<T> *pp, Node<T> *ppp)
{
    if (pp->LeftChild->data == p->data || p->RightChild->data == p->data)
        return false;
    if (p->data > pp->data)
    {
        ppp = pp;
        pp = pp->RightChild;
    }
    else if (p->data < pp->data)
    {
        ppp = pp;
        pp = pp->LeftChild;
    }

    if (!fixRemove(p, pp, ppp))
    {
        Node<T> *b;
        if (pp->LeftChild == p)
        {
            b = pp->RightChild;
            if (pp->color == red)
            {
                pp->color = black;
                rorateLeft(&b, &pp, &ppp);
                return true;
            }
            else
            {
                if (b->color == red)
                {
                    b->color = black;
                    rorateLeft(&b, &pp, &ppp);
                    return true;
                }
                else
                {
                    if (b->RightChild->color == red)
                    {
                        b->RightChild->color = black;
                        rorateLeft(&b, &pp, &ppp);
                        return true;
                    }
                    else if (b->LeftChild->color == red)
                    {
                        b->LeftChild->color = black;
                        rorateRight(&(b->LeftChild), &b, &pp);
                        rorateLeft(&b, &pp, &ppp);
                        return true;
                    }
                    b->color = red;
                    return false;
                }
            }
        }
        if (pp->RightChild == p)
        {
            b = pp->LeftChild;
            if (pp->color == red)
            {
                pp->color = black;
                rorateRight(&b, &pp, &ppp);
                return true;
            }
            else
            {
                if (b->LeftChild->color == red)
                {
                    b->LeftChild->color = black;
                    rorateRight(&b, &pp, &ppp);
                    return true;
                }
                if (b->RightChild->color == red)
                {
                    b->RightChild->color = black;
                    rorateLeft(&(b->RightChild), &b, &pp);
                    rorateRight(&b, &pp, &ppp);
                    return true;
                }
                b->color = black;
                return false;
            }
        }
    }

    return true;
}
```





