<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(
    name: 'list_share',
    uniqueConstraints: [
        new ORM\UniqueConstraint(
            name: 'uniq_list_user',
            columns: ['list_id', 'user_id']
        )
    ]
)]
class ListShare
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: ListNode::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ListNode $list;

    #[ORM\ManyToOne(targetEntity: User::class, inversedBy: 'sharedLists')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: 'string', length: 20)]
    private string $permission; // 'read' | 'write'

    public function __construct(ListNode $list, User $user, string $permission = 'read')
    {
        if (!$list->isRoot()) {
            throw new \LogicException('Only root lists can be shared.');
        }

        $this->list = $list;
        $this->user = $user;
        $this->permission = $permission;
    }
}
