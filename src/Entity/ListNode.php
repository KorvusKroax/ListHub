<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity]
#[ORM\Table(name: 'list_node')]
class ListNode
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['list'])]
    private int $id;

    #[ORM\Column(type: 'string', length: 10)]
    #[Groups(['list'])]
    private string $type; // 'item' | 'sublist'

    #[ORM\Column(type: 'string', nullable: true)]
    #[Groups(['list'])]
    private ?string $name = null;

    #[ORM\Column(type: 'boolean')]
    #[Groups(['list'])]
    private bool $isChecked = false;

    #[ORM\Column(type: 'integer')]
    #[Groups(['list'])]
    private int $position = 0;

    #[ORM\ManyToOne(targetEntity: self::class, inversedBy: 'children')]
    private ?ListNode $parent = null;

    #[ORM\OneToMany(mappedBy: 'parent', targetEntity: self::class, cascade: ['persist', 'remove'])]
    private Collection $children;

    #[ORM\ManyToOne(targetEntity: User::class, inversedBy: 'ownedRootLists')]
    private ?User $owner = null;

    #[ORM\OneToMany(mappedBy: 'list', targetEntity: ListShare::class, cascade: ['persist', 'remove'])]
    private Collection $shares;

    public function __construct(string $type)
    {
        $this->type = $type;
        $this->children = new ArrayCollection();
        $this->shares = new ArrayCollection();
        $this->isChecked = false;
    }

    // -------------------------------
    // Getter / Setter
    // -------------------------------
    public function getId(): int { return $this->id; }

    public function getType(): string { return $this->type; }
    public function isItem(): bool { return $this->type === 'item'; }

    public function getName(): ?string { return $this->name; }
    public function setName(?string $name): void { $this->name = $name; }

    public function isChecked(): bool { return $this->isChecked; }
    public function setIsChecked(bool $isChecked): void { $this->isChecked = $isChecked; }

    public function getPosition(): int { return $this->position; }
    public function setPosition(int $position): void { $this->position = $position; }

    public function getParent(): ?self { return $this->parent; }
    public function setParent(?self $parent): void { $this->parent = $parent; }

    public function getChildren(): Collection { return $this->children; }
    public function addChild(self $child): void
    {
        if (!$this->children->contains($child)) {
            $this->children->add($child);
            $child->setParent($this);
        }
    }
    public function removeChild(self $child): void
    {
        if ($this->children->removeElement($child)) {
            $child->setParent(null);
        }
    }

    public function getOwner(): ?User { return $this->owner; }
    public function setOwner(?User $user): void
    {
        if ($this->parent !== null) {
            throw new \LogicException('Only root nodes can have an owner.');
        }
        $this->owner = $user;
    }

    public function isRoot(): bool { return $this->parent === null; }

    public function getShares(): Collection
    {
        return $this->isRoot() ? $this->shares : new ArrayCollection();
    }
    public function addShare(ListShare $share): void
    {
        if (!$this->shares->contains($share)) {
            $this->shares->add($share);
        }
    }
    public function removeShare(ListShare $share): void
    {
        $this->shares->removeElement($share);
    }
}
